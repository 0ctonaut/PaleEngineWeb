import { WebGPURenderer, Scene, Camera, PerspectiveCamera } from 'three/webgpu';
import { ViewHelperGizmo } from './view-helper-gizmo';
import { RenderPass } from './pass';

export interface ViewHelperGizmoPassConfig {
    size?: number;
    padding?: number;
    alignment?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export class ViewHelperGizmoPass implements RenderPass {
    private gizmo: ViewHelperGizmo;
    private camera: PerspectiveCamera;
    private enabled: boolean = true;
    private width: number = 0;
    private height: number = 0;
    private config: Required<ViewHelperGizmoPassConfig>;

    constructor(camera: PerspectiveCamera, config: ViewHelperGizmoPassConfig = {}) {
        this.camera = camera;
        this.config = {
            size: config.size ?? 128,
            padding: config.padding ?? 20,
            alignment: config.alignment ?? 'top-right'
        };
        
        this.gizmo = new ViewHelperGizmo({
            size: 0.5
        });
    }

    public async render(renderer: WebGPURenderer, _scene?: Scene, _camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        this.gizmo.syncWithCamera(this.camera.quaternion);

        // 计算Gizmo位置
        const { x, y } = this.calculatePosition();

        // 同步标签位置
        this.gizmo.setLabelPosition(x, y);

        // 启用scissor测试，限制渲染区域
        renderer.setScissorTest(true);
        renderer.setScissor(x, y, this.config.size, this.config.size);
        renderer.setViewport(x, y, this.config.size, this.config.size);
        renderer.clearDepth();
        
        await this.gizmo.render(renderer);

        // 恢复状态 - 恢复全屏viewport和scissor设置
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, this.width, this.height);
        renderer.setScissor(0, 0, this.width, this.height);
    }

    public setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    public dispose(): void {
        this.gizmo.dispose();
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
     * 计算Gizmo的位置
     */
    private calculatePosition(): { x: number; y: number } {
        const { size, padding, alignment } = this.config;

        switch (alignment) {
            case 'top-right':
                return {
                    x: this.width - size - padding,
                    y: padding
                };
            case 'top-left':
                return {
                    x: padding,
                    y: padding
                };
            case 'bottom-right':
                return {
                    x: this.width - size - padding,
                    y: this.height - size - padding
                };
            case 'bottom-left':
                return {
                    x: padding,
                    y: this.height - size - padding
                };
            default:
                return {
                    x: this.width - size - padding,
                    y: padding
                };
        }
    }

    /**
     * 处理点击事件，检查是否点击在Gizmo区域内
     * @param clientX 鼠标X坐标（相对于canvas）
     * @param clientY 鼠标Y坐标（相对于canvas）
     * @returns 点击的方向，如果没有点击在Gizmo上则返回null
     */
    public handleClick(clientX: number, clientY: number): import('./view-helper-gizmo').ViewDirection | null {
        const { x, y } = this.calculatePosition();
        const { size } = this.config;

        // 检查点击是否在Gizmo区域内
        if (clientX >= x && clientX <= x + size &&
            clientY >= y && clientY <= y + size) {
            
            // 转换为Gizmo本地坐标
            const localX = clientX - x;
            const localY = clientY - y;
            
            return this.gizmo.handleClick(localX, localY, size);
        }

        return null;
    }

    /**
     * 获取Gizmo实例（用于获取标签容器等）
     */
    public getGizmo(): ViewHelperGizmo {
        return this.gizmo;
    }

    /**
     * 获取标签容器（用于添加到DOM）
     */
    public getLabelContainer(): HTMLElement {
        return this.gizmo.getLabelContainer();
    }
}

