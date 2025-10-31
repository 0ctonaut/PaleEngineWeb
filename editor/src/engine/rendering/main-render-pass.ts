import { WebGPURenderer, Scene, Camera, Mesh } from 'three/webgpu';
import { OutlineRenderer, OutlineConfig } from './outline-renderer';
import { RenderPass } from './pass';

export class MainRenderPass implements RenderPass {
    private outlineRenderer: OutlineRenderer;
    private enabled: boolean = true;
    private scene: Scene;
    private camera: Camera;
    private selectedMesh: Mesh | null = null;

    constructor(
        outlineRenderer: OutlineRenderer,
        scene: Scene,
        camera: Camera
    ) {
        this.outlineRenderer = outlineRenderer;
        this.scene = scene;
        this.camera = camera;
    }

    public async render(renderer: WebGPURenderer, scene?: Scene, camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const renderScene = scene ?? this.scene;
        const renderCamera = camera ?? this.camera;

        await this.outlineRenderer.render(
            renderer,
            renderScene,
            renderCamera,
            this.selectedMesh ? [this.selectedMesh] : []
        );
    }

    public setSize(width: number, height: number): void {
        this.outlineRenderer.setSize(width, height);
    }

    public dispose(): void {
        this.outlineRenderer.dispose();
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

    /**
     * 设置选中的网格
     */
    public setSelectedMesh(mesh: Mesh | null): void {
        this.selectedMesh = mesh;
    }

    /**
     * 获取选中的网格
     */
    public getSelectedMesh(): Mesh | null {
        return this.selectedMesh;
    }

    /**
     * 更新配置
     */
    public updateConfig(config: Partial<OutlineConfig>): void {
        this.outlineRenderer.updateConfig(config);
    }
}

