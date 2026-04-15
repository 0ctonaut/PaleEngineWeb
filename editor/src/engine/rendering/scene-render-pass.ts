import { Scene, Camera} from 'three/webgpu';
import { RenderPass } from './pass';
import { Renderer } from './renderer';

export class SceneRenderPass implements RenderPass {
    private enabled: boolean = true;
    private scene: Scene;
    private camera: Camera;
    private _shouldClear: boolean = true;

    constructor(scene: Scene, camera: Camera, shouldClear: boolean = true) {
        this.scene = scene;
        this.camera = camera;
        this._shouldClear = shouldClear;
    }

    public async render(renderer: Renderer, scene?: Scene, camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        if (scene) this.scene = scene;
        if (camera) this.camera = camera;
        await renderer.render(this.scene, this.camera);    
    }

    public setSize(_width: number, _height: number): void {

    }

    public dispose(): void {
    }

    public enable(): void {
        this.enabled = true;
    }

    public disable(): void {
        this.enabled = false;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public shouldClear(): boolean {
        return this._shouldClear;
    }

    public setShouldClear(shouldClear: boolean): void {
        this._shouldClear = shouldClear;
    }
}
