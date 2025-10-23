import { 
    createCamera, 
    createScene, 
    createRenderer, 
    createCube, 
    createSphere, 
    createLights, 
    Resizer 
} from '@paleengine/core';
import { PerspectiveCamera, WebGPURenderer, Scene, Mesh } from 'three/webgpu';

export class World {
    private readonly _camera: PerspectiveCamera;
    private readonly _renderer: WebGPURenderer;
    private readonly _scene: Scene;
    private readonly _meshes: Mesh[] = [];
    private _animationId: number | null = null;

    public constructor(container: HTMLElement) {
        this._camera = createCamera(75, 1, 0.1, 1000, [0, 0, 10]);
        this._scene = createScene();
        this._renderer = createRenderer();
        
        new Resizer(container, this._camera, this._renderer);
        
        this._initializeScene();
        
        this._setupRenderer(container);
        
        this._startAnimation();
    }

    public animate(): void {
        this._animationId = requestAnimationFrame(() => this.animate());
        this._updateMeshes();
        this._render();
    }

    public stopAnimation(): void {
        if (this._animationId !== null) {
            cancelAnimationFrame(this._animationId);
            this._animationId = null;
        }
    }

    public addMesh(mesh: Mesh): void {
        this._scene.add(mesh);
        this._meshes.push(mesh);
    }

    public removeMesh(mesh: Mesh): void {
        this._scene.remove(mesh);
        const index = this._meshes.indexOf(mesh);
        if (index > -1) {
            this._meshes.splice(index, 1);
        }
    }

    private _initializeScene(): void {
        const cube = createCube();
        cube.position.set(-2, 0, 0);
        this.addMesh(cube);

        const sphere = createSphere(1, 8, 'orange');
        sphere.position.set(2, 0, 0);
        this.addMesh(sphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        this._scene.add(floor);

        const light = createLights();
        light.position.set(10, 10, 10);
        this._scene.add(light);
    }


    private _setupRenderer(container: HTMLElement): void {
        this._renderer.setSize(container.clientWidth, container.clientHeight);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        container.append(this._renderer.domElement);
    }


    private _startAnimation(): void {
        this.animate();
    }


    private _updateMeshes(): void {
        this._meshes.forEach(mesh => {
            mesh.rotation.x += 0.01;
            mesh.rotation.y += 0.01;
            mesh.rotation.z += 0.01;
        });
    }

    private _render(): void {
        this._renderer.render(this._scene, this._camera);
    }
}
