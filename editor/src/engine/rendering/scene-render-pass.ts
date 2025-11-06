import { WebGPURenderer, Scene, Camera, PostProcessing, Mesh, Color } from 'three/webgpu';
import { RenderPass } from './pass';
import { pass, uniform } from 'three/tsl';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';

export interface OutlineConfig {
    color: Color;
    thickness: number;
    alpha: number;
}

export class SceneRenderPass implements RenderPass {
    private postProcessing!: PostProcessing;
    private enabled: boolean = true;
    private scene: Scene;
    private camera: Camera;
    private _shouldClear: boolean = true;
    
    // Outline addon
    private outlineEnabled: boolean = false;
    private outlineConfig: OutlineConfig | null = null;
    private outlinePass: ReturnType<typeof outline> | null = null;
    private edgeStrength: ReturnType<typeof uniform> | null = null;
    private edgeGlow: ReturnType<typeof uniform> | null = null;
    private edgeThickness: ReturnType<typeof uniform> | null = null;
    private visibleEdgeColor: ReturnType<typeof uniform> | null = null;
    private hiddenEdgeColor: ReturnType<typeof uniform> | null = null;
    private selectedObjects: Mesh[] = [];

    constructor(scene: Scene, camera: Camera, shouldClear: boolean = true) {
        this.scene = scene;
        this.camera = camera;
        this._shouldClear = shouldClear;
    }

    private initializeUniforms(): void {
        if (!this.outlineConfig) {
            return;
        }
        
        if (!this.edgeStrength) {
            this.edgeStrength = uniform(this.outlineConfig.alpha);
            this.edgeGlow = uniform(0.0);
            this.edgeThickness = uniform(this.outlineConfig.thickness);
            this.visibleEdgeColor = uniform(this.outlineConfig.color);
            this.hiddenEdgeColor = uniform(new Color(0x4e3636));
        } else {
            if (this.edgeStrength) this.edgeStrength.value = this.outlineConfig.alpha;
            if (this.edgeThickness) this.edgeThickness.value = this.outlineConfig.thickness;
            if (this.visibleEdgeColor) this.visibleEdgeColor.value = this.outlineConfig.color;
        }
    }

    private initializePostProcessing(renderer: WebGPURenderer): void {
        if (this.postProcessing) {
            return;
        }

        const scenePass = pass(this.scene, this.camera);
        
        let outputNode: any = scenePass;
        
        if (this.outlineEnabled && this.outlineConfig) {
            if (!this.edgeStrength || !this.edgeThickness || !this.visibleEdgeColor) {
                this.initializeUniforms();
            }
            
            if (this.edgeThickness && this.edgeGlow && this.visibleEdgeColor && 
                this.hiddenEdgeColor && this.edgeStrength) {
                this.outlinePass = outline(this.scene, this.camera, {
                    selectedObjects: this.selectedObjects,
                    edgeThickness: this.edgeThickness,
                    edgeGlow: this.edgeGlow
                });

                const { visibleEdge, hiddenEdge } = this.outlinePass;
                const outlineColor = visibleEdge
                    .mul(this.visibleEdgeColor)
                    .add(hiddenEdge.mul(this.hiddenEdgeColor))
                    .mul(this.edgeStrength);

                outputNode = outlineColor.add(scenePass);
            }
        }
        
        this.postProcessing = new PostProcessing(renderer);
        this.postProcessing.outputNode = outputNode;
    }

    public async render(renderer: WebGPURenderer, scene?: Scene, camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        if (scene) this.scene = scene;
        if (camera) this.camera = camera;

        // 如果没有启用 outline，直接使用 renderer.render() 而不是 PostProcessing
        // 这样可以确保 framebuffer 被正确清除，避免颜色残留问题
        if (!this.outlineEnabled) {
            // 清理 PostProcessing（如果存在）
            if (this.postProcessing) {
                this.postProcessing.dispose();
                this.postProcessing = null as any;
            }
            if (this.outlinePass) {
                this.outlinePass.dispose();
                this.outlinePass = null;
            }
            
            // 直接渲染场景
            await renderer.render(this.scene, this.camera);
            return;
        }

        // 启用 outline 时使用 PostProcessing
        const sceneChanged = scene !== undefined && scene !== this.scene;
        const cameraChanged = camera !== undefined && camera !== this.camera;
        
        if (this.postProcessing && (sceneChanged || cameraChanged)) {
            if (this.outlinePass) {
                this.outlinePass.dispose();
                this.outlinePass = null;
            }
            
            this.postProcessing.dispose();
            this.postProcessing = null as any;
        }
        
        this.initializePostProcessing(renderer);
        
        if (this.outlinePass) {
            this.outlinePass.selectedObjects = this.selectedObjects;
        }
        
        await this.postProcessing.renderAsync();
    }

    public setSize(_width: number, _height: number): void {
        // PostProcessing handles size updates automatically when enabled
        // When outline is disabled, renderer handles size updates automatically
    }

    public dispose(): void {
        if (this.postProcessing) {
            this.postProcessing.dispose();
            this.postProcessing = null as any;
        }
        
        if (this.outlinePass) {
            this.outlinePass.dispose();
            this.outlinePass = null;
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

    public setShouldClear(shouldClear: boolean): void {
        this._shouldClear = shouldClear;
    }

    public enableOutline(config: OutlineConfig): void {
        if (this.outlinePass) {
            this.outlinePass.dispose();
            this.outlinePass = null;
        }
        
        this.outlineEnabled = true;
        this.outlineConfig = config;
        this.initializeUniforms();
        
        if (this.postProcessing) {
            this.postProcessing.dispose();
            this.postProcessing = null as any;
        }
    }

    public disableOutline(): void {
        if (this.outlinePass) {
            this.outlinePass.dispose();
            this.outlinePass = null;
        }
        
        this.outlineEnabled = false;
        this.outlineConfig = null;
        
        if (this.postProcessing) {
            this.postProcessing.dispose();
            this.postProcessing = null as any;
        }
    }

    public isOutlineEnabled(): boolean {
        return this.outlineEnabled;
    }

    public setSelectedObjects(objects: Mesh[]): void {
        this.selectedObjects = objects;
    }

    public updateOutlineConfig(config: Partial<OutlineConfig>): void {
        if (!this.outlineConfig) {
            return;
        }
        
        if (config.color !== undefined) {
            this.outlineConfig.color = config.color;
            if (this.visibleEdgeColor) {
                this.visibleEdgeColor.value = config.color;
            }
        }
        
        if (config.thickness !== undefined) {
            this.outlineConfig.thickness = config.thickness;
            if (this.edgeThickness) {
                this.edgeThickness.value = config.thickness;
            }
        }
        
        if (config.alpha !== undefined) {
            this.outlineConfig.alpha = config.alpha;
            if (this.edgeStrength) {
                this.edgeStrength.value = config.alpha;
            }
        }
    }

    public getOutlineConfig(): OutlineConfig | null {
        return this.outlineConfig ? { ...this.outlineConfig } : null;
    }
}
