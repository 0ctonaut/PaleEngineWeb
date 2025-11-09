import {
    createCamera,
    createScene,
    createRenderer,
    createCube,
    createSphere,
    createLights,
    Resizer,
    SelectionCategory
} from '@paleengine/core';
import { PerspectiveCamera, WebGPURenderer, Scene, Mesh, Color, Object3D } from 'three/webgpu';
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
    private readonly scene: Scene;
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

    public constructor(container: HTMLElement) {
        this.container = container;
        this.camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this.scene = createScene();
        this.renderer = createRenderer();
        
        // Initialize performance monitor
        this.performanceMonitor = new PerformanceMonitor();
        
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
        
        this.scene.clear();
    }

    public addMesh(mesh: Mesh): void {
        this.scene.add(mesh);
        this.meshes.push(mesh);
        this.emitHierarchyChange('add', { object: mesh, parent: mesh.parent ?? null });
    }

    public removeMesh(mesh: Mesh): void {
        const parent = mesh.parent ?? null;
        this.scene.remove(mesh);
        const index = this.meshes.indexOf(mesh);
        if (index > -1) {
            this.meshes.splice(index, 1);
        }

        if (this.selectedObject === mesh) {
            this.setSelectedObject(null);
        }

        this.emitHierarchyChange('remove', { object: mesh, parent });
    }

    public createPrimitive(type: 'cube' | 'sphere', parent?: Object3D | null): Object3D {
        let object: Object3D;

        switch (type) {
            case 'sphere':
                object = createSphere();
                break;
            case 'cube':
                object = createCube();
                break;
            default:
                throw new Error(`Unknown primitive type: ${type}`);
        }

        const targetParent = parent ?? this.scene;
        targetParent.add(object);

        if (!object.name || object.name.trim().length === 0) {
            object.name = this.generatePrimitiveName(type);
        }

        if (object instanceof Mesh) {
            this.meshes.push(object);
        }

        if (!object.userData.selectionCategory) {
            object.userData.selectionCategory = SelectionCategory.SCENE_OBJECT;
        }

        this.emitHierarchyChange('add', { object, parent: targetParent });
        this.setSelectedObject(object);
        return object;
    }

    private generatePrimitiveName(type: 'cube' | 'sphere'): string {
        const baseName = type.charAt(0).toUpperCase() + type.slice(1);
        return `${baseName}`;
    }

    private initializeScene(): void {
        // Enable all layers for editor camera to see everything
        this.camera.layers.enableAll();
        
        const cube = createCube();
        cube.position.set(-2, 0, 0);
        cube.name = 'Example-Cube';
        this.addMesh(cube);

        const sphere = createSphere(1, 8, 'orange');
        sphere.position.set(2, 0, 0);
        sphere.name = 'Example-Sphere';
        this.addMesh(sphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        floor.name = 'Example-Floor';
        this.scene.add(floor);

        const light = createLights();
        light.position.set(10, 10, 10);
        light.name = 'Example-Light';
        this.scene.add(light);

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
        this.processorManager.update(deltaTime);
    }
    
    public async render(width: number, height: number, gizmoSize?: number): Promise<void> {
        this.cameraController.update();
        
        if (gizmoSize !== undefined && this.viewHelperGizmoPass) {
            this.viewHelperGizmoPass.setGizmoSize(gizmoSize);
        }
        
        this.renderer.setViewport(0, 0, width, height);
        await this.passManager.render(this.renderer, this.scene, this.camera);
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
                minDistance: 1,
                maxDistance: 100
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

        this.sceneRenderPass = new SceneRenderPass(this.scene, this.camera, true);
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
        return this.scene;
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

    private emitHierarchyChange(type: HierarchyChangeType, payload: { object?: Object3D | null; parent?: Object3D | null } = {}): void {
        this.emit('hierarchychange', {
            scene: this.scene,
            type,
            object: payload.object ?? null,
            parent: payload.parent ?? null
        });
    }
}