import { 
    createCamera, 
    createScene, 
    createRenderer, 
    createCube, 
    createSphere, 
    createLights, 
    Resizer 
} from '@paleengine/core';
import { PerspectiveCamera, WebGPURenderer, Scene, Mesh, Color } from 'three/webgpu';
import { LocalInputManager, InputContext, EventTypes, InputEvent } from './input';
import { 
    OutlineRenderer, 
    OutlineConfig, 
    ViewHelperGizmo,
    PassManager,
    MainRenderPass,
    ViewHelperGizmoPass,
    GridPass
} from './rendering';
import { OrbitCameraController } from './camera';
import { ProcessorManager, SelectionProcessor, TransformProcessor, UndoRedoProcessor } from './processors';
import { CommandManager } from './commands';

export class World {
    private readonly camera: PerspectiveCamera;
    private readonly renderer: WebGPURenderer;
    private readonly scene: Scene;
    private readonly meshes: Mesh[] = [];
    private animationId: number | null = null;
    private inputManager!: LocalInputManager;
    private canvasInputContext!: InputContext;
    private selectedMesh: Mesh | null = null;
    private outlineRenderer!: OutlineRenderer;
    private resizer!: Resizer;
    private cameraController!: OrbitCameraController;
    private container!: HTMLElement;
    
    // Pass system
    private passManager!: PassManager;
    private mainRenderPass!: MainRenderPass;
    private viewHelperGizmoPass!: ViewHelperGizmoPass;
    // @ts-expect-error - Reserved for future use
    private gridPass!: GridPass;
    
    // Processor architecture
    private processorManager!: ProcessorManager;
    private selectionProcessor!: SelectionProcessor;
    private transformProcessor!: TransformProcessor;
    private undoRedoProcessor!: UndoRedoProcessor;
    
    // Command system
    private commandManager!: CommandManager;
    
    // Time tracking
    private lastFrameTime: number = 0;

    public constructor(container: HTMLElement) {
        this.container = container;
        this.camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this.scene = createScene();
        this.renderer = createRenderer();
        
        this.initializeInputSystem(container);
        this.initializeCameraController();
        this.initializeOutlineRenderer(container);
        this.initializePassSystem();
        
        this.resizer = new Resizer(container, this.camera, this.renderer, (width: number, height: number) => {
            this.updateRenderSize(width, height);
        });
        
        this.initializeScene();
        this.setupRenderer(container);
        this.startAnimation();
    }

    public async animate(): Promise<void> {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.calculateDeltaTime();
        this.processorManager.update(deltaTime);
        await this.render();
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
        
        this.scene.clear();
    }

    public addMesh(mesh: Mesh): void {
        this.scene.add(mesh);
        this.meshes.push(mesh);
    }

    public removeMesh(mesh: Mesh): void {
        this.scene.remove(mesh);
        const index = this.meshes.indexOf(mesh);
        if (index > -1) {
            this.meshes.splice(index, 1);
        }
    }

    private initializeScene(): void {
        // Enable all layers for editor camera to see everything
        this.camera.layers.enableAll();
        
        const cube = createCube();
        cube.position.set(-2, 0, 0);
        this.addMesh(cube);

        const sphere = createSphere(1, 8, 'orange');
        sphere.position.set(2, 0, 0);
        this.addMesh(sphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        this.scene.add(floor);

        const light = createLights();
        light.position.set(10, 10, 10);
        this.scene.add(light);
    }

    private setupRenderer(container: HTMLElement): void {
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        const canvas = this.renderer.domElement;
        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';
        
        container.append(this.renderer.domElement);
    }

    private startAnimation(): void {
        this.animate();
    }

    private async render(): Promise<void> {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.renderer.setViewport(0, 0, width, height);
        await this.passManager.render(this.renderer, this.scene, this.camera);
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
        
        this.mainRenderPass = new MainRenderPass(this.outlineRenderer, this.scene, this.camera);
        this.passManager.addPass('main', this.mainRenderPass);
        
        this.gridPass = new GridPass({
            cellSize: 50,
            color: new Color(0x666666),
            lineWidth: 1.5,
            opacity: 0.5,
            showMajorGrid: true,
            majorGridInterval: 5,
            majorGridColor: new Color(0x888888),
            majorGridLineWidth: 2.0
        });
        
        this.viewHelperGizmoPass = new ViewHelperGizmoPass(this.camera);
        this.passManager.addPass('gizmo', this.viewHelperGizmoPass);
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.passManager.setSize(width, height);
        
        const labelContainer = this.viewHelperGizmoPass.getLabelContainer();
        this.container.appendChild(labelContainer);
    }
    
    private setupInputHandlers(): void {
        // Gizmo click handling - use MOUSE_UP to execute before SelectionProcessor
        // World handlers are registered first, so they execute before processor handlers
        this.inputManager.on(EventTypes.MOUSE_UP, (event: InputEvent) => {
            const direction = this.viewHelperGizmoPass.handleClick(event.position.x, event.position.y);
            
            if (direction !== null) {
                event.stopPropagation();
                
                const params = ViewHelperGizmo.getViewParameters(direction, this.cameraController.getDistance());
                this.cameraController.setAngles(params.azimuth, params.polar);
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

    public setSelectedMesh(mesh: Mesh | null): void {
        this.selectedMesh = mesh;
        if (this.mainRenderPass) {
            this.mainRenderPass.setSelectedMesh(mesh);
        }
    }

    public getSelectedMesh(): Mesh | null {
        return this.selectedMesh;
    }

    public getCommandManager(): CommandManager {
        return this.commandManager;
    }

    public getTransformProcessor(): TransformProcessor {
        return this.transformProcessor;
    }
}