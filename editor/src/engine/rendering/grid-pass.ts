import { Scene, Color, Camera } from 'three/webgpu';
import { InfiniteGridHelper } from './infinite-grid-helper';
import { RenderPass } from './pass';
import { Renderer } from './renderer';

export interface GridPassConfig {
    size1?: number;
    size2?: number;
    color?: Color | number;
    far?: number;
}

export class GridPass implements RenderPass {
    private enabled: boolean = true;
    private _shouldClear: boolean = false;
    private grid: InfiniteGridHelper;

    constructor(config: GridPassConfig = {}) {
        const size1 = config.size1 ?? 0.1;
        const size2 = config.size2 ?? 1;
        const color = config.color ?? 0xaaaaaa;
        const far = config.far ?? 500;

        // 创建无限网格，位于 y=0
        this.grid = new InfiniteGridHelper(size1, size2, color, far);
    }

    public addToScene(scene: Scene): void {
        scene.add(this.grid);
    }

    public removeFromScene(scene: Scene): void {
        scene.remove(this.grid);
    }

    public async render(_renderer: Renderer, _scene?: Scene, _camera?: Camera): Promise<void> {
        // 网格已经在主场景中，不需要单独渲染
        // SceneRenderPass 会负责渲染主场景中的所有对象
    }

    public setSize(_width: number, _height: number): void {

    }

    public dispose(): void {
        if (this.grid) {
            this.grid.geometry.dispose();
            (this.grid.material as any).dispose();
        }
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

    public setColor(color: Color | number): void {
        this.grid.setColor(color);
    }

    public setSizes(size1: number, size2: number): void {
        this.grid.setSizes(size1, size2);
    }
}
