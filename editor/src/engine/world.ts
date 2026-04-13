import {
    createCamera,
    createRenderer,
    createCube,
    createSphere,
    createLights,
    Resizer,
    SelectionCategory,
    AnimationController,
    PaleScene,
    PaleObject
} from '@paleengine/core';
import { ComponentCamera } from '@paleengine/core';
import { PerspectiveCamera, WebGPURenderer, Scene, Mesh, Color, Object3D, Group } from 'three/webgpu';
import { LocalInputManager, InputContext, EventTypes, InputEvent } from './input';
import {
    OutlineRenderer,
    OutlineConfig,
    PassManager,
    SceneRenderPass,
    ViewHelperGizmoPass
} from './rendering';
import { ViewHelperGizmo } from './rendering/view-helper-gizmo';
import { OrbitCameraController } from './camera';
import { ProcessorManager, SelectionProcessor, TransformProcessor, UndoRedoProcessor } from './processors';
import { CommandManager } from './commands';
import { PerformanceMonitor } from './profiler';
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

export class World {
    private readonly camera: PerspectiveCamera;
    private readonly renderer: WebGPURenderer;
    private readonly gameRenderer: WebGPURenderer; // Game viewport 的 renderer
    private readonly paleScene: PaleScene;
    private readonly meshes: Mesh[] = [];
    private animationId: number | null = null;
    private isDisposed: boolean = false;
    private inputManager!: LocalInputManager;
    private canvasInputContext!: InputContext;
    private selectedObject: Object3D | null = null;
    private resizer!: Resizer;
    private cameraController!: OrbitCameraController;
    private container!: HTMLElement;
    private readonly eventListeners: { [K in keyof WorldEventMap]: Set<(event: WorldEventMap[K]) => void> } = {
        selectionchange: new Set(),
        hierarchychange: new Set()
    };
    
    // Mode management
    private modeManager!: ModeManager;

    public setContainer(container: HTMLElement): void {
        this.container = container;
        if (this.resizer) {
            this.resizer.updateSize();
        }
    }
    
    // Pass system
    private passManager!: PassManager;
    private sceneRenderPass!: SceneRenderPass;
    private viewHelperGizmoPass!: ViewHelperGizmoPass;
    private outlineRenderer!: OutlineRenderer;
    
    // Processor architecture
    private processorManager!: ProcessorManager;
    private selectionProcessor!: SelectionProcessor;
    private transformProcessor!: TransformProcessor;
    private undoRedoProcessor!: UndoRedoProcessor;
    
    // Command system
    private commandManager!: CommandManager;
    
    // Time tracking
    private lastFrameTime: number = 0;
    
    // Performance monitoring
    private performanceMonitor!: PerformanceMonitor;
    
    // Animation controllers
    private animationControllers: AnimationController[] = [];
    
    // Time controller
    private timeController!: TimeController;
    
    // Main camera for Game mode
    private mainCamera!: PaleObject;
    private mainCameraComponent!: ComponentCamera;

    public constructor(container: HTMLElement) {
        this.container = container;
        this.camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this.paleScene = new PaleScene();
        this.renderer = createRenderer();
        this.gameRenderer = createRenderer(); // 为 Game viewport 创建单独的 renderer
        
        // Initialize mode manager
        this.modeManager = new ModeManager();
        
        // Initialize performance monitor
        this.performanceMonitor = new PerformanceMonitor();
        
        // Initialize time controller
        this.timeController = new TimeController();
        
        this.initializeInputSystem(container);
        this.initializeCameraController();
        this.initializeOutlineRenderer(container);
        this.initializePassSystem();
        
        this.resizer = new Resizer(container, this.camera, this.renderer, (width: number, height: number) => {
            this.updateRenderSize(width, height);
        });
        
        this.initializeScene();
        this.setupRenderer(container);
    }

    public async animate(): Promise<void> {
        if (this.isDisposed) {
            return;
        }
        
        const deltaTime = this.calculateDeltaTime();
        this.performanceMonitor.update();
        this.processorManager.update(deltaTime);
        
        // Update time controller (which handles animation time synchronization)
        this.timeController.update(deltaTime);
        
        // Update all animation controllers
        this.animationControllers.forEach(controller => {
            controller.update(deltaTime);
        });
        
        await this.renderInternal();
        
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
        
        if (this.outlineRenderer) {
            this.outlineRenderer.dispose();
        }
        
        if (this.passManager) {
            this.passManager.dispose();
        }
        
        if (this.resizer) {
            this.resizer.dispose();
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
        
        if (this.renderer) {
            const canvas = this.renderer.domElement;
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            if (typeof (this.renderer as any).dispose === 'function') {
                (this.renderer as any).dispose();
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

    public createPrimitive(type: 'cube' | 'sphere', parent?: PaleObject | Object3D | null): PaleObject {
        let paleObject: PaleObject;
        switch (type) {
            case 'sphere':
                paleObject = createSphere();
                break;
            case 'cube':
                paleObject = createCube();
                break;
            default:
                throw new Error(`Unknown primitive type: ${type}`);
        }

        if (!paleObject.name || paleObject.name.trim().length === 0) {
            paleObject.name = this.generatePrimitiveName(type);
        }

        const threeObject = paleObject.getThreeObject();
        if (threeObject instanceof Mesh) {
            this.meshes.push(threeObject);
        }

        // Set tag (如果还没有设置)
        if (paleObject.tag === null) {
            paleObject.tag = SelectionCategory.SCENE_OBJECT;
        }

        // 处理父对象
        if (parent) {
            if (parent instanceof PaleObject) {
                parent.add(paleObject);
            } else {
                // 兼容旧代码：直接添加到 Three.js 场景
                const parentPaleObject = (parent as any).__paleObject;
                if (parentPaleObject) {
                    parentPaleObject.add(paleObject);
                } else {
                    this.paleScene.getThreeScene().add(threeObject);
                }
            }
        } else {
            this.addObject(paleObject);
        }

        this.emitHierarchyChange('add', { object: threeObject, parent: threeObject.parent ?? null });
        this.setSelectedObject(threeObject);
        return paleObject;
    }

    private generatePrimitiveName(type: 'cube' | 'sphere'): string {
        const baseName = type.charAt(0).toUpperCase() + type.slice(1);
        return `${baseName}`;
    }

    private initializeScene(): void {
        // Enable all layers for editor camera to see everything
        this.camera.layers.enableAll();
        
        // 创建 MainCamera
        const mainCameraObject = new PaleObject(new Object3D(), 'MainCamera');
        mainCameraObject.position.set(0, 0, 10);
        this.mainCameraComponent = new ComponentCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        mainCameraObject.addComponent(this.mainCameraComponent);
        this.mainCamera = mainCameraObject;
        this.addObject(mainCameraObject);
        // MainCamera 不添加到场景中，它是独立的游戏对象
        
        const cube = createCube();
        cube.position.set(-2, 0, 0);
        cube.name = 'Example-Cube';
        this.addObject(cube);

        const sphere = createSphere(1, 8, 'orange');
        sphere.position.set(2, 0, 0);
        sphere.name = 'Example-Sphere';
        this.addObject(sphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        floor.name = 'Example-Floor';
        this.addObject(floor);

        const light = createLights();
        light.position.set(10, 10, 10);
        light.name = 'Example-Light';
        this.addObject(light);

        this.emitHierarchyChange('refresh');
    }

    private setupRenderer(container: HTMLElement): void {
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        const canvas = this.renderer.domElement;
        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';
        
        container.append(this.renderer.domElement);
    }

    /**
     * 更新逻辑（需要在渲染前调用）
     */
    public update(deltaTime: number): void {
        this.performanceMonitor.update();
        
        const currentMode = this.modeManager.getCurrentMode();
        
        if (currentMode === EditorMode.Scene) {
            // Scene 模式：执行编辑器处理器
            this.processorManager.update(deltaTime);
        } else {
            // Game 模式：执行组件系统更新
            this.paleScene.update(deltaTime);
        }
        
        // 无论什么模式，都同步 MainCamera 的变换到相机
        // 这样在 Scene 模式下，如果 MainCamera 的 position 被修改，相机也会同步更新
        if (this.mainCameraComponent) {
            this.mainCameraComponent.syncTransform();
        }
        
        // Update time controller (which handles animation time synchronization)
        this.timeController.update(deltaTime);
        
        // Update all animation controllers
        this.animationControllers.forEach(controller => {
            controller.update(deltaTime);
        });
    }
    
    public async render(width: number, height: number, gizmoSize?: number, useGameCamera: boolean = false): Promise<void> {
        const currentMode = this.modeManager.getCurrentMode();
        const targetRenderer = useGameCamera ? this.gameRenderer : this.renderer;
        
        if (currentMode === EditorMode.Scene && !useGameCamera) {
            // Scene 模式：更新相机控制器和 gizmo
            this.cameraController.update();
            
            if (gizmoSize !== undefined && this.viewHelperGizmoPass) {
                this.viewHelperGizmoPass.setGizmoSize(gizmoSize);
            }
        }
        // Game 模式：相机控制器由游戏逻辑控制，不更新编辑器相机控制器
        
        // 根据模式选择相机
        let targetCamera: PerspectiveCamera;
        if (useGameCamera && this.mainCameraComponent) {
            // 更新 MainCamera 的 aspect
            const aspect = width / height;
            this.mainCameraComponent.aspect = aspect;
            targetCamera = this.mainCameraComponent.camera;
        } else {
            targetCamera = this.camera;
        }
        
        targetRenderer.setViewport(0, 0, width, height);
        await this.passManager.render(targetRenderer, this.paleScene.getThreeScene(), targetCamera);
    }
    
    /**
     * 获取 Game renderer
     */
    public getGameRenderer(): WebGPURenderer {
        return this.gameRenderer;
    }
    
    private async renderInternal(): Promise<void> {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        await this.render(width, height);
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
            this.camera,
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
    
    private initializeOutlineRenderer(container: HTMLElement): void {
        const outlineConfig: OutlineConfig = {
            color: new Color(0x00ff00),
            thickness: 5,
            alpha: 1.0
        };
        
        this.outlineRenderer = new OutlineRenderer(
            container.clientWidth,
            container.clientHeight,
            outlineConfig
        );
    }
    
    private initializePassSystem(): void {
        this.passManager = new PassManager();

        this.sceneRenderPass = new SceneRenderPass(this.paleScene.getThreeScene(), this.camera, true);
        // outline remain bugs
        // const outlineConfig: OutlineConfig = {
        //     color: new Color(0x00ff00),
        //     thickness: 5,
        //     alpha: 1.0,
        // };
        // this.sceneRenderPass.enableOutline(outlineConfig);
        this.passManager.addPass('scene', this.sceneRenderPass);
        
        this.viewHelperGizmoPass = new ViewHelperGizmoPass(this.camera);
        this.passManager.addPass('gizmo', this.viewHelperGizmoPass);
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.passManager.setSize(width, height);
    }
    
    private setupInputHandlers(): void {
        // Handle view helper gizmo hover
        this.inputManager.on(EventTypes.MOUSE_MOVE, (event: InputEvent) => {
            if (this.viewHelperGizmoPass) {
                // Get mouse position relative to canvas
                const canvas = this.renderer.domElement;
                const rect = canvas.getBoundingClientRect();
                const clientX = event.globalPosition.x - rect.left;
                const clientY = event.globalPosition.y - rect.top;
                
                // Update hover state
                this.viewHelperGizmoPass.handleHover(clientX, clientY);
            }
        });
        
        // Handle view helper gizmo clicks
        this.inputManager.on(EventTypes.CLICK, (event: InputEvent) => {
            if (this.viewHelperGizmoPass) {
                // Get click position relative to canvas
                const canvas = this.renderer.domElement;
                const rect = canvas.getBoundingClientRect();
                const clientX = event.globalPosition.x - rect.left;
                const clientY = event.globalPosition.y - rect.top;
                
                // Check if click hits gizmo and handle view change
                const direction = this.viewHelperGizmoPass.handleClick(clientX, clientY);
                if (direction) {
                    // Get view parameters from direction
                    const { azimuth, polar } = ViewHelperGizmo.getViewParameters(direction, this.cameraController.getDistance());
                    // Update camera angles
                    this.cameraController.setAngles(azimuth, polar);
                    // Stop event propagation to prevent other handlers from processing
                    event.stopPropagation();
                }
            }
        });
        
        this.inputManager.on(EventTypes.MOUSE_DOWN, (_event: InputEvent) => {
            const canvas = this.renderer.domElement;
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
        
        if (this.outlineRenderer) {
            this.outlineRenderer.setSize(width, height);
        }
    }
    
    public updateOutlineConfig(config: Partial<OutlineConfig>): void {
        if (this.sceneRenderPass && this.sceneRenderPass.isOutlineEnabled()) {
            this.sceneRenderPass.updateOutlineConfig(config);
        }

        if (this.outlineRenderer) {
            this.outlineRenderer.updateConfig(config);
        }
    }

    public getCameraController(): OrbitCameraController {
        return this.cameraController;
    }

    public getCamera(): PerspectiveCamera {
        return this.camera;
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
        // 保存编辑器状态
        this.modeManager.saveState({
            selectedObject: this.selectedObject,
            cameraPosition: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            cameraRotation: {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            }
        });
        
        // 禁用编辑器处理器
        this.selectionProcessor.disable();
        this.transformProcessor.disable();
        
        // 清除选择
        this.setSelectedObject(null);
        
        // 重置组件系统（准备重新开始）
        this.paleScene.reset();
        
        // 注册 MainCamera 的组件
        const mainCameraComponents = this.mainCamera.getAllComponents();
        for (const component of mainCameraComponents) {
            this.paleScene.getComponentManager().registerComponent(component);
        }
        
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
                this.camera.position.set(
                    savedState.cameraPosition.x,
                    savedState.cameraPosition.y,
                    savedState.cameraPosition.z
                );
            }
            if (savedState.cameraRotation) {
                this.camera.rotation.set(
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
        return this.renderer;
    }

    public setSelectedObject(object: Object3D | null): void {
        if (this.selectedObject === object) {
            return;
        }

        this.selectedObject = object;
        if (this.sceneRenderPass && this.sceneRenderPass.isOutlineEnabled()) {
            if (object instanceof Mesh) {
                this.sceneRenderPass.setSelectedObjects([object]);
            } else {
                this.sceneRenderPass.setSelectedObjects([]);
            }
        }
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

    public getPerformanceMonitor(): PerformanceMonitor {
        return this.performanceMonitor;
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
    
    /**
     * 获取 MainCamera
     */
    public getMainCamera(): PaleObject {
        return this.mainCamera;
    }
    
    /**
     * 获取 MainCamera 的 ComponentCamera 组件
     */
    public getMainCameraComponent(): ComponentCamera {
        return this.mainCameraComponent;
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