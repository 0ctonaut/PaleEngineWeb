import { 
    WebGPURenderer,
    Scene, 
    Camera, 
    Mesh, 
    Color,
    PostProcessing
} from 'three/webgpu';
import { pass, uniform } from 'three/tsl';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';

export interface OutlineConfig {
    color: Color;
    thickness: number;
    alpha: number;
}

export class OutlineRenderer {
    private config: OutlineConfig;
    private postProcessing!: PostProcessing;
    private outlinePass!: ReturnType<typeof outline>;
    private edgeStrength!: ReturnType<typeof uniform>;
    private edgeGlow!: ReturnType<typeof uniform>;
    private edgeThickness!: ReturnType<typeof uniform>;
    private visibleEdgeColor!: ReturnType<typeof uniform>;
    private hiddenEdgeColor!: ReturnType<typeof uniform>;

    constructor(_width: number, _height: number, config: OutlineConfig) {
        this.config = config;
        this.initializeUniforms();
    }

    private initializeUniforms(): void {
        this.edgeStrength = uniform(this.config.alpha);
        this.edgeGlow = uniform(0.0);
        this.edgeThickness = uniform(this.config.thickness);
        this.visibleEdgeColor = uniform(this.config.color);
        this.hiddenEdgeColor = uniform(new Color(0x4e3636));
    }

    private initializePostProcessing(renderer: WebGPURenderer, scene: Scene, camera: Camera): void {
        if (this.postProcessing) {
            return;
        }

        this.outlinePass = outline(scene, camera, {
            selectedObjects: [],
            edgeThickness: this.edgeThickness,
            edgeGlow: this.edgeGlow
        });

        const scenePass = pass(scene, camera);
        const { visibleEdge, hiddenEdge } = this.outlinePass;
        const outlineColor = visibleEdge
            .mul(this.visibleEdgeColor)
            .add(hiddenEdge.mul(this.hiddenEdgeColor))
            .mul(this.edgeStrength);

        this.postProcessing = new PostProcessing(renderer);
        this.postProcessing.outputNode = outlineColor.add(scenePass);
    }

    public async render(
        renderer: WebGPURenderer,
        scene: Scene,
        camera: Camera,
        selectedObjects: Mesh[]
    ): Promise<void> {
        this.initializePostProcessing(renderer, scene, camera);
        this.outlinePass.selectedObjects = selectedObjects;
        await this.postProcessing.renderAsync();
    }

    public setSize(_width: number, _height: number): void {
        // PostProcessing handles size updates automatically
    }

    public updateConfig(config: Partial<OutlineConfig>): void {
        if (config.color !== undefined) {
            this.config.color = config.color;
            this.visibleEdgeColor.value = config.color;
        }
        
        if (config.thickness !== undefined) {
            this.config.thickness = config.thickness;
            this.edgeThickness.value = config.thickness;
        }
        
        if (config.alpha !== undefined) {
            this.config.alpha = config.alpha;
            this.edgeStrength.value = config.alpha;
        }
    }

    public getConfig(): OutlineConfig {
        return { ...this.config };
    }

    public dispose(): void {
        if (this.postProcessing) {
            this.postProcessing.dispose();
        }
        
        if (this.outlinePass) {
            this.outlinePass.dispose();
        }
    }
}