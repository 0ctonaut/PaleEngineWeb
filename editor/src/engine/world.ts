/// <reference types="vite/client" />
import {
    createCamera,
    createRenderer,
    createCube,
    createGlassSphere,
    createMirrorSphere,
    SelectionCategory,
    Layers,
    AnimationController,
    PaleScene,
    PaleObject
} from '@paleengine/core';
import { 
    PerspectiveCamera, 
    WebGPURenderer, 
    Scene, 
    Mesh, 
    Object3D, 
    Group,
    EquirectangularReflectionMapping,
    ACESFilmicToneMapping,
    Color,
    SRGBColorSpace
} from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { LocalInputManager, InputContext, EventTypes, InputEvent } from './input';
import {
    PassManager,
    SceneRenderPass,
    ViewHelperGizmoPass,
    Renderer
} from './rendering';
import { ViewHelperGizmo } from './rendering/view-helper-gizmo';
import { InfiniteGridHelper } from './rendering/infinite-grid-helper';
import { OrbitCameraController } from './camera';
import { ProcessorManager, SelectionProcessor, TransformProcessor, UndoRedoProcessor } from './processors';
import { CommandManager } from './commands';
import { TimeController } from './time-controller';
import { ModeManager, EditorMode } from './mode-manager';

export type HierarchyChangeType = 'refresh' | 'add' | 'remove';

export interface HierarchyChangeEvent {
    scene: Scene;
    type: HierarchyChangeType;
    object?: Object3D | null;
    parent?: Object3D | null;
}

export type WorldEventMap = {
    selectionchange: { selected: Object3D | null };
    hierarchychange: HierarchyChangeEvent;
};

export interface RendererState {
    camera: PerspectiveCamera;
    renderer: WebGPURenderer;
}

export class PaleWorld {
    private readonly sceneState: RendererState;
    private readonly gameState: RendererState;
    private readonly paleScene: PaleScene;
    private readonly meshes: Mesh[] = [];
    private animationId: number | null = null;
    private isDisposed: boolean = false;
    private inputManager!: LocalInputManager;
    private canvasInputContext!: InputContext;
    private selectedObject: Object3D | null = null;
    private cameraController!: OrbitCameraController;
    private readonly eventListeners: { [K in keyof WorldEventMap]: Set<(event: WorldEventMap[K]) => void> } = {
        selectionchange: new Set(),
        hierarchychange: new Set()
    };
    
    // Mode management
    private modeManager!: ModeManager;

    // Pass system
    private passManager!: PassManager;
    private sceneRenderPass!: SceneRenderPass;
    private viewHelperGizmoPass!: ViewHelperGizmoPass;
    
    // Processor architecture
    private processorManager!: ProcessorManager;
    private selectionProcessor!: SelectionProcessor;
    private transformProcessor!: TransformProcessor;
    private undoRedoProcessor!: UndoRedoProcessor;
    
    // Command system
    private commandManager!: CommandManager;
    
    // Time tracking
    private lastFrameTime: number = 0;

    // Animation controllers
    private animationControllers: AnimationController[] = [];
    
    // Time controller
    private timeController!: TimeController;

    public constructor(container: HTMLElement) {
        const sceneCamera = createCamera(60, 1, 0.1, 5000, [0, 0, 10]);
        const sceneRenderer = createRenderer();
        const gameCamera = createCamera(60, 1, 0.1, 5000, [0, 0, 10]);
        const gameRenderer = createRenderer();
        this.sceneState = { camera: sceneCamera, renderer: sceneRenderer };
        this.gameState = { camera: gameCamera, renderer: gameRenderer };
        this.paleScene = new PaleScene();
        
        // Initialize mode manager
        this.modeManager = new ModeManager();
        
        // Initialize time controller
        this.timeController = new TimeController();
        
        this.initializeInputSystem(container);
        this.initializeCameraController();
        this.initializePassSystem();
        
        this.initializeScene();
        this.setupRenderer(container);
        
        // 异步加载天空盒
        this.loadSkybox();
    }

    public async animate(): Promise<void> {
        if (this.isDisposed) {
            return;
        }
        
        const deltaTime = this.calculateDeltaTime();
        this.processorManager.update(deltaTime);
        
        // Update time controller (which handles animation time synchronization)
        this.timeController.update(deltaTime);
        
        // Update all animation controllers
        this.animationControllers.forEach(controller => {
            controller.update(deltaTime);
        });
        
        this.render();
        
        if (!this.isDisposed) {
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    private calculateDeltaTime(): number {
        const currentTime = performance.now();
        const deltaTime = this.lastFrameTime === 0 ? 0 : (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        return deltaTime;
    }

    public stopAnimation(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    public dispose(): void {
        this.isDisposed = true;
        this.stopAnimation();
        
        // Dispose all animation controllers
        this.animationControllers.forEach(controller => {
            controller.dispose();
        });
        this.animationControllers = [];
        
        if (this.inputManager) {
            this.inputManager.dispose();
        }
        
        if (this.passManager) {
            this.passManager.dispose();
        }
        
        if (this.processorManager) {
            this.processorManager.dispose();
        }
        
        if (this.commandManager) {
            this.commandManager.clear();
        }
        
        if (this.cameraController) {
            this.cameraController.dispose();
        }

        if (this.sceneState.renderer) {
            const canvas = this.sceneState.renderer.domElement;
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            if (typeof (this.sceneState.renderer as any).dispose === 'function') {
                (this.sceneState.renderer as any).dispose();
            }
        }

        this.paleScene.clear();
    }

    public addMesh(mesh: Mesh): void {
        // 兼容旧代码：将 Mesh 包装为 PaleObject
        const paleObject = new PaleObject(mesh, mesh.name);
        this.addObject(paleObject);
    }

    public addObject(object: PaleObject | Object3D): void {
        let paleObject: PaleObject;
        
        if (object instanceof PaleObject) {
            paleObject = object;
        } else {
            // 兼容旧代码：将 Object3D 包装为 PaleObject
            paleObject = new PaleObject(object, object.name);
        }
        
        const threeObject = paleObject.getThreeObject();
        
        // Set tag (如果还没有设置)
        if (paleObject.tag === null) {
            paleObject.tag = SelectionCategory.SCENE_OBJECT;
        }
        
        // If object is a Mesh, add to meshes array
        if (threeObject instanceof Mesh) {
            this.meshes.push(threeObject);
        }
        
        // If object is a Group, traverse and collect all Meshes
        if (threeObject instanceof Group) {
            threeObject.traverse((child) => {
                if (child instanceof Mesh) {
                    this.meshes.push(child);
                }
                // 为子对象设置 tag（如果还没有 PaleObject 包装）
                const childPaleObject = (child as any).__paleObject;
                if (childPaleObject) {
                    if (childPaleObject.tag === null) {
                        childPaleObject.tag = SelectionCategory.SCENE_OBJECT;
                    }
                } else if (!child.userData.selectionCategory) {
                    // 向后兼容：如果子对象没有 PaleObject 包装，直接设置 userData
                    child.userData.selectionCategory = SelectionCategory.SCENE_OBJECT;
                }
            });
        }
        
        // 添加到 PaleScene（会自动注册组件）
        this.paleScene.add(paleObject);
        
        this.emitHierarchyChange('add', { object: threeObject, parent: threeObject.parent ?? null });
    }

    public removeMesh(mesh: Mesh): void {
        // 查找对应的 PaleObject
        const paleObject = (mesh as any).__paleObject;
        if (paleObject) {
            this.removeObject(paleObject);
        } else {
            // 如果没有 PaleObject 包装，直接移除
            const parent = mesh.parent ?? null;
            this.paleScene.getThreeScene().remove(mesh);
            const index = this.meshes.indexOf(mesh);
            if (index > -1) {
                this.meshes.splice(index, 1);
            }

            if (this.selectedObject === mesh) {
                this.setSelectedObject(null);
            }

            this.emitHierarchyChange('remove', { object: mesh, parent });
        }
    }
    
    public removeObject(object: PaleObject): void {
        const threeObject = object.getThreeObject();
        const parent = threeObject.parent ?? null;
        
        // 从 PaleScene 移除（会自动注销组件）
        this.paleScene.remove(object);
        
        // 从 meshes 数组移除
        if (threeObject instanceof Mesh) {
            const index = this.meshes.indexOf(threeObject);
            if (index > -1) {
                this.meshes.splice(index, 1);
            }
        }
        
        // 如果是选中的对象，清除选择
        if (this.selectedObject === threeObject) {
            this.setSelectedObject(null);
        }

        this.emitHierarchyChange('remove', { object: threeObject, parent });
    }

    private initializeScene(): void {
        this.sceneState.camera.layers.enableAll();

        const mirrorCube = createMirrorSphere();
        mirrorCube.position.set(-2, 0, 0);
        mirrorCube.name = 'Example-Cube';
        this.addObject(mirrorCube);

        const glassSphere = createGlassSphere();
        glassSphere.position.set(2, 0, 0);
        glassSphere.name = 'Example-Glass-Ball';
        this.addObject(glassSphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        floor.name = 'Example-Floor';
        this.addObject(floor);

        this.emitHierarchyChange('refresh');
    }

    private setupRenderer(container: HTMLElement): void {
        this.sceneState.renderer.setSize(container.clientWidth, container.clientHeight);
        this.sceneState.renderer.setPixelRatio(window.devicePixelRatio);

        this.sceneState.renderer.toneMapping = ACESFilmicToneMapping;
        this.sceneState.renderer.toneMappingExposure = 1.0;
        this.sceneState.renderer.outputColorSpace = SRGBColorSpace;

        const canvas = this.sceneState.renderer.domElement;
        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';

        container.append(this.sceneState.renderer.domElement);
    }

    public update(deltaTime: number): void {
        const currentMode = this.modeManager.getCurrentMode();
        
        if (currentMode === EditorMode.Scene) {
            // Scene 模式：执行编辑器处理器
            this.processorManager.update(deltaTime);
        } else {
            // Game 模式：执行组件系统更新
            this.paleScene.update(deltaTime);
        }

        // Update time controller (which handles animation time synchronization)
        this.timeController.update(deltaTime);
        
        // Update all animation controllers
        this.animationControllers.forEach(controller => {
            controller.update(deltaTime);
        });
    }
    
    public async render(gizmoSize?: number): Promise<void> {
        const currentMode = this.modeManager.getCurrentMode();
        const targetState = this.sceneState;

        if (currentMode === EditorMode.Scene) {
            this.cameraController.update();
            if (gizmoSize !== undefined && this.viewHelperGizmoPass) {
                this.viewHelperGizmoPass.setGizmoSize(gizmoSize);
            }
        }

        const targetCamera = targetState.camera;

        const renderer = new Renderer(targetState.renderer);
        await this.passManager.render(renderer, this.paleScene.getThreeScene(), targetCamera);
    }
    
    /**
     * 获取 Game renderer
     */
    public getGameRenderer(): WebGPURenderer {
        return this.gameState.renderer;
    }
    
    
    private initializeInputSystem(container: HTMLElement): void {
        this.canvasInputContext = new InputContext({
            name: 'canvas',
            priority: 0
        });
        this.canvasInputContext.activate();
        
        this.inputManager = new LocalInputManager(
            container,
            this.canvasInputContext,
            {
                dragConfig: {
                    threshold: 5,
                    button: [0, 2]
                }
            }
        );
        
        // Setup World-level input handlers before processors register their handlers
        // This ensures World handlers execute first (Set iteration order is insertion order)
        this.setupInputHandlers();
        
        this.processorManager = new ProcessorManager();
        this.commandManager = new CommandManager();
        
        this.selectionProcessor = new SelectionProcessor(this, this.inputManager);
        this.processorManager.addProcessor('selection', this.selectionProcessor);
        
        this.transformProcessor = new TransformProcessor(this, this.inputManager);
        this.processorManager.addProcessor('transform', this.transformProcessor);
        
        this.undoRedoProcessor = new UndoRedoProcessor(this, this.inputManager);
        this.processorManager.addProcessor('undoRedo', this.undoRedoProcessor);
    }
    
    private initializeCameraController(): void {
        this.cameraController = new OrbitCameraController(
            this.sceneState.camera,
            this.inputManager,
            {
                rotateSensitivity: 0.01,
                panSensitivity: 0.01,
                zoomSensitivity: 0.1,
                minDistance: 0.1,
                maxDistance: 10000
            }
        );
    }
    
    private async loadSkybox(): Promise<void> {
        const scene = this.paleScene.getThreeScene();
        try {
            console.log('Loading HDR skybox...');

            const hdrLoader = new HDRLoader();
            const baseUrl = import.meta.env.BASE_URL;
            const texture = await hdrLoader.loadAsync(`${baseUrl}assets/skyboxes/qwantani_moon_noon_puresky_1k.hdr`.replace(/\/+/g, '/'));
            // 设置纹理映射方式
            texture.mapping = EquirectangularReflectionMapping;

            scene.background = texture;
            scene.environment = texture;

            console.log('Skybox applied to scene');
        } catch (error) {
            console.error('Failed to load HDR skybox:', error);
            scene.background = new Color(0x87CEEB);
        }
    }

    private initializePassSystem(): void {
        this.passManager = new PassManager();

        const grid = new InfiniteGridHelper(0.1, 1, 0x444444, this.sceneState.camera.far);
        grid.layers.set(Layers.UI);
        const paleObject = new PaleObject(grid, 'Grid');
        paleObject.tag = SelectionCategory.UI_HELPER;
        this.addMesh(paleObject.getThreeObject() as Mesh);

        this.sceneRenderPass = new SceneRenderPass(this.paleScene.getThreeScene(), this.sceneState.camera, true);

        this.passManager.addPass('scene', this.sceneRenderPass);

        this.viewHelperGizmoPass = new ViewHelperGizmoPass(this.sceneState.camera);
        this.passManager.addPass('gizmo', this.viewHelperGizmoPass);
    }
    
    private setupInputHandlers(): void {
        // Handle view helper gizmo hover
        this.inputManager.on(EventTypes.MOUSE_MOVE, (event: InputEvent) => {
            if (this.viewHelperGizmoPass) {
                const canvas = this.sceneState.renderer.domElement;
                const rect = canvas.getBoundingClientRect();
                const clientX = event.globalPosition.x - rect.left;
                const clientY = event.globalPosition.y - rect.top;

                this.viewHelperGizmoPass.handleHover(clientX, clientY);
            }
        });

        this.inputManager.on(EventTypes.CLICK, (event: InputEvent) => {
            if (this.viewHelperGizmoPass) {
                const canvas = this.sceneState.renderer.domElement;
                const rect = canvas.getBoundingClientRect();
                const clientX = event.globalPosition.x - rect.left;
                const clientY = event.globalPosition.y - rect.top;

                const direction = this.viewHelperGizmoPass.handleClick(clientX, clientY);
                if (direction) {
                    const { azimuth, polar } = ViewHelperGizmo.getViewParameters(direction, this.cameraController.getDistance());
                    this.cameraController.setAngles(azimuth, polar);
                    event.stopPropagation();
                }
            }
        });

        this.inputManager.on(EventTypes.MOUSE_DOWN, (_event: InputEvent) => {
            const canvas = this.sceneState.renderer.domElement;
            canvas.focus();
        });
        
        this.inputManager.on(EventTypes.CONTEXT_MENU, (event: InputEvent) => {
            event.preventDefault();
        });
    }
    
    public updateRenderSize(width: number, height: number): void {
        if (this.passManager) {
            this.passManager.setSize(width, height);
        }
    }

    public getCameraController(): OrbitCameraController {
        return this.cameraController;
    }

    public getCamera(): PerspectiveCamera {
        return this.sceneState.camera;
    }

    public updateSize(width: number, height: number): void {
        // TODO: 需要区分scene和game
        this.sceneState.renderer.setSize(width, height);
        this.sceneState.renderer.setPixelRatio(window.devicePixelRatio);
        this.sceneState.camera.aspect = width / height;
        this.sceneState.camera.updateProjectionMatrix();

        this.gameState.renderer.setSize(width, height);
        this.gameState.renderer.setPixelRatio(window.devicePixelRatio);
        this.gameState.camera.aspect = width / height;
        this.gameState.camera.updateProjectionMatrix();

        if (this.passManager) {
            this.passManager.setSize(width, height);
        }
    }

    public getScene(): Scene {
        return this.paleScene.getThreeScene();
    }
    
    public getPaleScene(): PaleScene {
        return this.paleScene;
    }
    
    public getModeManager(): ModeManager {
        return this.modeManager;
    }
    
    /**
     * 进入 Game 模式
     */
    public enterGameMode(): void {
        this.modeManager.saveState({
            selectedObject: this.selectedObject,
            cameraPosition: {
                x: this.sceneState.camera.position.x,
                y: this.sceneState.camera.position.y,
                z: this.sceneState.camera.position.z
            },
            cameraRotation: {
                x: this.sceneState.camera.rotation.x,
                y: this.sceneState.camera.rotation.y,
                z: this.sceneState.camera.rotation.z
            }
        });
        
        // 禁用编辑器处理器
        this.selectionProcessor.disable();
        this.transformProcessor.disable();
        
        // 清除选择
        this.setSelectedObject(null);
        
        // 重置组件系统（准备重新开始）
        this.paleScene.reset();

        // 重新注册所有场景对象的组件（触发 Awake）
        const objects = this.paleScene.getObjects();
        for (const object of objects) {
            const components = object.getAllComponents();
            for (const component of components) {
                this.paleScene.getComponentManager().registerComponent(component);
            }
            // 递归处理子对象
            object.traverse((child) => {
                if (child !== object) {
                    const childComponents = child.getAllComponents();
                    for (const component of childComponents) {
                        this.paleScene.getComponentManager().registerComponent(component);
                    }
                }
            });
        }
        
        // 切换到 Game 模式
        this.modeManager.enterGameMode();
    }
    
    /**
     * 进入 Scene 模式
     */
    public enterSceneMode(): void {
        // 切换到 Scene 模式
        this.modeManager.enterSceneMode();
        
        // 恢复编辑器状态
        const savedState = this.modeManager.restoreState();
        if (savedState) {
            if (savedState.selectedObject) {
                this.setSelectedObject(savedState.selectedObject);
            }
            if (savedState.cameraPosition) {
                this.sceneState.camera.position.set(
                    savedState.cameraPosition.x,
                    savedState.cameraPosition.y,
                    savedState.cameraPosition.z
                );
            }
            if (savedState.cameraRotation) {
                this.sceneState.camera.rotation.set(
                    savedState.cameraRotation.x,
                    savedState.cameraRotation.y,
                    savedState.cameraRotation.z
                );
            }
        }
        
        // 启用编辑器处理器
        this.selectionProcessor.enable();
        this.transformProcessor.enable();
    }

    public getRenderer(): WebGPURenderer {
        return this.sceneState.renderer;
    }

    public setSelectedObject(object: Object3D | null): void {
        if (this.selectedObject === object) {
            return;
        }

        this.selectedObject = object;
        this.emitSelectionChange();
    }

    public getSelectedObject(): Object3D | null {
        return this.selectedObject;
    }

    public getCommandManager(): CommandManager {
        return this.commandManager;
    }

    public getTransformProcessor(): TransformProcessor {
        return this.transformProcessor;
    }

    /**
     * Register an AnimationController to be updated each frame
     */
    public registerAnimationController(controller: AnimationController): void {
        if (!this.animationControllers.includes(controller)) {
            this.animationControllers.push(controller);
            this.timeController.registerAnimationController(controller);
        }
    }

    /**
     * Unregister an AnimationController
     */
    public unregisterAnimationController(controller: AnimationController): void {
        const index = this.animationControllers.indexOf(controller);
        if (index > -1) {
            this.animationControllers.splice(index, 1);
            this.timeController.unregisterAnimationController(controller);
        }
    }

    /**
     * Get all registered AnimationControllers
     */
    public getAnimationControllers(): AnimationController[] {
        return [...this.animationControllers];
    }

    /**
     * Play all animations
     */
    public playAllAnimations(): void {
        this.timeController.play();
    }

    /**
     * Pause all animations
     */
    public pauseAllAnimations(): void {
        this.timeController.pause();
    }

    /**
     * Resume all animations
     */
    public resumeAllAnimations(): void {
        this.timeController.play();
    }

    /**
     * Check if any animation is playing
     */
    public isAnyAnimationPlaying(): boolean {
        return this.timeController.getIsPlaying();
    }

    /**
     * Get the TimeController instance
     */
    public getTimeController(): TimeController {
        return this.timeController;
    }

    public on<K extends keyof WorldEventMap>(type: K, listener: (event: WorldEventMap[K]) => void): void {
        this.eventListeners[type].add(listener);
    }

    public off<K extends keyof WorldEventMap>(type: K, listener: (event: WorldEventMap[K]) => void): void {
        this.eventListeners[type].delete(listener);
    }

    private emit<K extends keyof WorldEventMap>(type: K, event: WorldEventMap[K]): void {
        this.eventListeners[type].forEach(listener => {
            listener(event);
        });
    }

    private emitSelectionChange(): void {
        this.emit('selectionchange', { selected: this.selectedObject });
    }

    public requestHierarchyRefresh(): void {
        this.emitHierarchyChange('refresh');
    }

    private emitHierarchyChange(type: HierarchyChangeType, payload: { object?: Object3D | null; parent?: Object3D | null } = {}): void {
        this.emit('hierarchychange', {
            scene: this.paleScene.getThreeScene(),
            type,
            object: payload.object ?? null,
            parent: payload.parent ?? null
        });
    }
}