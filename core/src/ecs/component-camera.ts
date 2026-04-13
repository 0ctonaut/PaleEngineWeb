import { PerspectiveCamera } from 'three/webgpu';
import { MonoBehaviour } from '../components/mono-behavior';
import { createCamera, CameraPosition } from '../components/camera';

export class ComponentCamera extends MonoBehaviour {
    private _camera: PerspectiveCamera;
    private _fov: number = 75;
    private _near: number = 0.1;
    private _far: number = 100000;
    private _aspect: number = 1;

    constructor(
        fov: number = 75,
        aspect: number = 1,
        near: number = 0.1,
        far: number = 100000,
        position: CameraPosition = [0, 0, 10]
    ) {
        super();
        this._fov = fov;
        this._aspect = aspect;
        this._near = near;
        this._far = far;
        this._camera = createCamera(fov, aspect, near, far, position);
    }

    public get camera(): PerspectiveCamera {
        return this._camera;
    }

    public get fov(): number {
        return this._fov;
    }

    public set fov(value: number) {
        this._fov = value;
        this._camera.fov = value;
        this._camera.updateProjectionMatrix();
    }

    public get aspect(): number {
        return this._aspect;
    }

    public set aspect(value: number) {
        this._aspect = value;
        this._camera.aspect = value;
        this._camera.updateProjectionMatrix();
    }

    public get near(): number {
        return this._near;
    }

    public set near(value: number) {
        this._near = value;
        this._camera.near = value;
        this._camera.updateProjectionMatrix();
    }

    public get far(): number {
        return this._far;
    }

    public set far(value: number) {
        this._far = value;
        this._camera.far = value;
        this._camera.updateProjectionMatrix();
    }

    /**
     * 同步 GameObject 的变换到相机
     * 这个方法可以在任何模式下调用，用于保持相机和 GameObject 的同步
     */
    public syncTransform(): void {
        if (this.gameObject) {
            this._camera.position.copy(this.gameObject.position);
            this._camera.rotation.copy(this.gameObject.rotation);
            this._camera.quaternion.copy(this.gameObject.quaternion);
        }
    }

    public override Update(_deltaTime: number): void {
        // 同步 GameObject 的变换到相机
        // this.syncTransform();
    }

    public override OnDestroy(): void {
        // 清理相机资源（如果需要）
        // Three.js 的相机通常不需要特殊清理
    }
}


