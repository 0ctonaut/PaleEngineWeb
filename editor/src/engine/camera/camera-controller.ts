import { PerspectiveCamera } from 'three/webgpu';

export abstract class CameraController {
    protected camera: PerspectiveCamera;
    protected enabled: boolean = true;

    constructor(camera: PerspectiveCamera) {
        this.camera = camera;
    }

    /**
     * Update camera controller
     * Subclasses should handle input and update camera state in this method
     */
    public abstract update(): void;

    public enable(): void {
        this.enabled = true;
    }

    public disable(): void {
        this.enabled = false;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public abstract dispose(): void;
}
