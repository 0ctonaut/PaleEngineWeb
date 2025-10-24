import { 
    createCamera, 
    createScene, 
    createRenderer, 
    createCube, 
    createSphere, 
    createLights, 
    Resizer 
} from '@paleengine/core';
import { PerspectiveCamera, WebGPURenderer, Scene, Mesh, Raycaster, Vector2, Color } from 'three/webgpu';
import { LocalInputManager, InputContext, InputEvent, EventTypes } from './input';
import { OutlineRenderer, OutlineConfig } from './rendering';

export class World {
    private readonly camera: PerspectiveCamera;
    private readonly renderer: WebGPURenderer;
    private readonly scene: Scene;
    private readonly meshes: Mesh[] = [];
    private animationId: number | null = null;
    private inputManager!: LocalInputManager;
    private canvasInputContext!: InputContext;
    private raycaster!: Raycaster;
    private selectedMesh: Mesh | null = null;
    private outlineRenderer!: OutlineRenderer;
    private resizer!: Resizer;

    public constructor(container: HTMLElement) {
        this.camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this.scene = createScene();
        this.renderer = createRenderer();
        
        this.initializeInputSystem(container);
        this.initializeOutlineRenderer(container);
        
        this.resizer = new Resizer(container, this.camera, this.renderer, (width, height) => {
            this.updateOutlineSize(width, height);
        });
        
        this.initializeScene();
        this.setupRenderer(container);
        this.startAnimation();
    }

    public async animate(): Promise<void> {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.updateMeshes();
        await this.render();
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
        container.append(this.renderer.domElement);
    }

    private startAnimation(): void {
        this.animate();
    }

    private updateMeshes(): void {
        this.meshes.forEach(mesh => {
            mesh.rotation.x += 0.01;
            mesh.rotation.y += 0.01;
            mesh.rotation.z += 0.01;
        });
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
        
        this.raycaster = new Raycaster();
        
        this.inputManager = new LocalInputManager(
            container,
            this.canvasInputContext,
            {
                dragConfig: {
                    threshold: 5,
                    button: 0
                }
            }
        );
        
        this.setupInputHandlers();
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
        this.inputManager.on(EventTypes.CLICK, (event) => {
            this.handleClick(event);
        });
        
        this.inputManager.on(EventTypes.DRAG_START, () => {
            console.log('Camera drag started');
        });
        
        this.inputManager.on(EventTypes.DRAG, (event) => {
            this.handleCameraDrag(event);
        });
        
        this.inputManager.on(EventTypes.DRAG_END, () => {
            console.log('Camera drag ended');
        });
        
        this.inputManager.on(EventTypes.WHEEL, (event) => {
            this.handleWheel(event);
        });
    }
    
    private handleClick(event: InputEvent): void {
        const vector2 = new Vector2(event.normalizedPosition.x, event.normalizedPosition.y);
        this.raycaster.setFromCamera(vector2, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const mesh = intersects[0].object as Mesh;
            this.selectMesh(mesh);
        } else {
            this.deselectMesh();
        }
    }
    
    private handleCameraDrag(event: InputEvent): void {
        const sensitivity = 0.01;
        this.camera.rotation.y -= event.delta!.x * sensitivity;
        this.camera.rotation.x -= event.delta!.y * sensitivity;
        
        this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
    }
    
    private handleWheel(event: InputEvent): void {
        const wheelEvent = event.originalEvent as WheelEvent;
        const zoomSpeed = 0.1;
        const zoom = wheelEvent.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
        
        this.camera.position.multiplyScalar(zoom);
        
        const distance = this.camera.position.length();
        if (distance < 1) {
            this.camera.position.normalize().multiplyScalar(1);
        } else if (distance > 50) {
            this.camera.position.normalize().multiplyScalar(50);
        }
    }
    
    private selectMesh(mesh: Mesh): void {
        this.selectedMesh = mesh;
        console.log('Selected mesh:', mesh);
    }
    
    private deselectMesh(): void {
        this.selectedMesh = null;
        console.log('Deselected mesh');
    }
    
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
}