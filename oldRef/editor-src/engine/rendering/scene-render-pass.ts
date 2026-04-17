import type { Scene } from 'babylonjs';
import type { Engine } from 'babylonjs';
import type { Camera } from 'babylonjs';
import { RenderPass } from './pass';

export class SceneRenderPass implements RenderPass {
    private _enabled: boolean = true;
    private _scene: Scene;
    private _shouldClear: boolean = true;

    constructor(scene: Scene, _camera: Camera, shouldClear: boolean = true) {
        this._scene = scene;
        this._shouldClear = shouldClear;
    }

    public async render(_engine: Engine, scene?: Scene, _camera?: Camera): Promise<void> {
        if (!this._enabled) {
            return;
        }

        if (scene) this._scene = scene;
        this._scene.render();
    }

    public setSize(_width: number, _height: number): void {
    }

    public dispose(): void {
    }

    public enable(): void {
        this._enabled = true;
    }

    public disable(): void {
        this._enabled = false;
    }

    public isEnabled(): boolean {
        return this._enabled;
    }

    public shouldClear(): boolean {
        return this._shouldClear;
    }

    public setShouldClear(shouldClear: boolean): void {
        this._shouldClear = shouldClear;
    }
}