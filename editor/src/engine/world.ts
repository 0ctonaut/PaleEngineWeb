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
import { LocalInputManager, InputContext } from './input';
import { OutlineRenderer, OutlineConfig } from './rendering';
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
        this.camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this.scene = createScene();
        this.renderer = createRenderer();
        
        this.initializeInputSystem(container);
        this.initializeCameraController();
        this.initializeProcessors();
        this.initializeOutlineRenderer(container);
        
        this.resizer = new Resizer(container, this.camera, this.renderer, (width: number, height: number) => {
            this.updateOutlineSize(width, height);
        });
        
        this.initializeScene();
        this.setupRenderer(container);
        this.startAnimation();
    }

    public async animate(): Promise<void> {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.calculateDeltaTime();
        // Update processor layer
        this.processorManager.update(deltaTime);    
        // Render
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
  
        // Make canvas focusable to receive keyboard events
        canvas.setAttribute('tabindex', '0');
        canvas.style.outline = 'none';  // Remove focus outline

        // Auto-focus canvas on mouse interaction
        canvas.addEventListener('mousedown', () => {
            canvas.focus();
        });
        
        // Disable right-click context menu
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        container.append(this.renderer.domElement);
    }

    private startAnimation(): void {
        this.animate();
    }

    private async render(): Promise<void> {
        await this.outlineRenderer.render(
            this.renderer,
            this.scene,
            this.camera,
            this.selectedMesh ? [this.selectedMesh] : []
        );
    }
    
    private initializeInputSystem(container: HTMLElement): void {
        this.canvasInputContext = new InputContext({
            name: 'canvas',
            priority: 0
        });
        this.canvasInputContext.activate();
        
        // raycaster now managed by SelectionProcessor
        
        this.inputManager = new LocalInputManager(
            container,
            this.canvasInputContext,
            {
                dragConfig: {
                    threshold: 5,
                    button: [0, 2] // Support left(0) and right(2) button dragging
                }
            }
        );
        
        this.setupInputHandlers();
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

    private initializeProcessors(): void {
        this.processorManager = new ProcessorManager();
        
        // Initialize command manager
        this.commandManager = new CommandManager();
        
        // Add selection processor
        this.selectionProcessor = new SelectionProcessor(this, this.inputManager);
        this.processorManager.addProcessor('selection', this.selectionProcessor);
        
        // Add transform processor
        this.transformProcessor = new TransformProcessor(this, this.inputManager);
        this.processorManager.addProcessor('transform', this.transformProcessor);
        
        // Add undo/redo processor
        this.undoRedoProcessor = new UndoRedoProcessor(this, this.inputManager);
        this.processorManager.addProcessor('undoRedo', this.undoRedoProcessor);
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
    
    private setupInputHandlers(): void {
        // Input handling is now managed by the processor layer
        // Global input logic can be added here
    }
    
    
    // Selection logic is now handled by SelectionProcessor
    
    public updateOutlineSize(width: number, height: number): void {
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

    // Provide accessors for processors
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