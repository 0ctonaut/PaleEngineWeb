import { WebGPURenderer, Scene, Camera, PostProcessing, Color } from 'three/webgpu';
import { uniform, uv, vec2, vec4, float, mod, min as minNode, smoothstep } from 'three/tsl';
import { RenderPass } from './pass';

export interface GridConfig {
    cellSize?: number;
    color?: Color;
    lineWidth?: number;
    opacity?: number;
    showMajorGrid?: boolean;
    majorGridInterval?: number;
    majorGridColor?: Color;
    majorGridLineWidth?: number;
}

export class GridPass implements RenderPass {
    private config: Required<GridConfig>;
    private postProcessing!: PostProcessing;
    private enabled: boolean = true;
    private width: number = 0;
    private height: number = 0;
    private initialized: boolean = false;

    constructor(config: GridConfig = {}) {
        this.config = {
            cellSize: config.cellSize ?? 50,
            color: config.color ?? new Color(0x888888),
            lineWidth: config.lineWidth ?? 1.5,
            opacity: config.opacity ?? 0.5,
            showMajorGrid: config.showMajorGrid ?? true,
            majorGridInterval: config.majorGridInterval ?? 5,
            majorGridColor: config.majorGridColor ?? new Color(0xaaaaaa),
            majorGridLineWidth: config.majorGridLineWidth ?? 2.0
        };
    }

    public async render(renderer: WebGPURenderer, _scene?: Scene, _camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        if (!this.initialized) {
            this.initialize(renderer);
        }

        await this.postProcessing.renderAsync();
    }

    public setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        
        if (this.postProcessing) {
            // PostProcessing会自动处理尺寸变化，但我们需要更新uniforms
            this.updateUniforms();
        }
    }

    public dispose(): void {
        if (this.postProcessing) {
            this.postProcessing.dispose();
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

    /**
     * 更新配置
     */
    public updateConfig(config: Partial<GridConfig>): void {
        Object.assign(this.config, config);
        
        if (this.initialized) {
            this.updateUniforms();
        }
    }

    public getConfig(): GridConfig {
        return { ...this.config };
    }

    private initialize(renderer: WebGPURenderer): void {
        const cellSizeUniform = uniform(this.config.cellSize);
        const colorUniform = uniform(this.config.color);
        const lineWidthUniform = uniform(this.config.lineWidth);
        const opacityUniform = uniform(this.config.opacity);
        const resolutionUniform = uniform(vec2(this.width, this.height));
        
        const screenUV = uv();
        const pixelCoord = screenUV.mul(resolutionUniform);
        const gridLines = this.createGridLines(pixelCoord, cellSizeUniform, lineWidthUniform);

        // 将网格线强度（float）应用到颜色（vec3）
        const gridColor = colorUniform.mul(gridLines);
        let finalColor = gridColor.mul(opacityUniform);
        
        if (this.config.showMajorGrid) {
            const majorGridColorUniform = uniform(this.config.majorGridColor);
            const majorGridLineWidthUniform = uniform(this.config.majorGridLineWidth);
            const majorGridIntervalUniform = uniform(this.config.majorGridInterval);
            
            const majorGridLines = this.createMajorGridLines(
                pixelCoord, 
                cellSizeUniform, 
                majorGridIntervalUniform,
                majorGridLineWidthUniform
            );
            
            // 混合主网格线和普通网格线（叠加模式）
            const majorGridColor = majorGridColorUniform.mul(majorGridLines).mul(opacityUniform);
            finalColor = finalColor.add(majorGridColor);
        }

        // 创建vec4输出，使用finalColor的RGB和opacity作为Alpha
        const gridColorWithAlpha = vec4(finalColor.rgb, opacityUniform);

        // 创建PostProcessing pipeline
        this.postProcessing = new PostProcessing(renderer);
        this.postProcessing.outputNode = gridColorWithAlpha;

        this.initialized = true;
    }

    /**
     * 创建网格线shader节点
     */
    private createGridLines(
        pixelCoord: any,
        cellSize: ReturnType<typeof uniform>,
        lineWidth: ReturnType<typeof uniform>
    ): ReturnType<typeof float> {
        // 计算到最近网格线的距离
        const gridX = mod(pixelCoord.x, cellSize);
        const gridY = mod(pixelCoord.y, cellSize);
        
        // 计算到网格线的距离（最近距离）
        const distToLineX = minNode(gridX, cellSize.sub(gridX));
        const distToLineY = minNode(gridY, cellSize.sub(gridY));
        const distToLine = minNode(distToLineX, distToLineY);
        
        // 使用smoothstep创建平滑的网格线
        const line = smoothstep(lineWidth.add(0.5), lineWidth.sub(0.5), distToLine);
        
        return float(1.0).sub(line);
    }

    /**
     * 创建主网格线shader节点
     */
    private createMajorGridLines(
        pixelCoord: any,
        cellSize: ReturnType<typeof uniform>,
        majorInterval: ReturnType<typeof uniform>,
        lineWidth: ReturnType<typeof uniform>
    ): ReturnType<typeof float> {
        const majorCellSize = cellSize.mul(majorInterval);
        
        // 计算到最近主网格线的距离
        const majorGridX = mod(pixelCoord.x, majorCellSize);
        const majorGridY = mod(pixelCoord.y, majorCellSize);
        
        // 计算到主网格线的距离
        const distToMajorLineX = minNode(majorGridX, majorCellSize.sub(majorGridX));
        const distToMajorLineY = minNode(majorGridY, majorCellSize.sub(majorGridY));
        const distToMajorLine = minNode(distToMajorLineX, distToMajorLineY);
        
        // 使用smoothstep创建平滑的主网格线
        const majorLine = smoothstep(lineWidth.add(0.5), lineWidth.sub(0.5), distToMajorLine);
        
        return float(1.0).sub(majorLine);
    }

    private updateUniforms(): void {
        // PostProcessing会自动处理uniform更新
        // 如果需要动态更新配置，可以在这里重新初始化
    }
}

