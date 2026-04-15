import { WebGPURenderer, Scene, Camera, Color } from 'three/webgpu';

/**
 * 自定义 Renderer 类，封装 WebGPURenderer
 * 提供统一的渲染接口给 Pass 系统使用
 */
export class Renderer {
    private renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer) {
        this.renderer = renderer;
    }

    /**
     * 获取底层的 WebGPURenderer
     */
    public getWebGPURenderer(): WebGPURenderer {
        return this.renderer;
    }

    /**
     * 渲染场景
     */
    public async render(scene: Scene, camera: Camera): Promise<void> {
        await this.renderer.renderAsync(scene, camera);
    }

    /**
     * 获取 autoClearColor
     */
    public get autoClear(): boolean {
        return this.renderer.autoClear;
    }

    public set autoClear(value: boolean) {
        this.renderer.autoClear = value;
    }

    /**
     * 设置清除颜色
     */
    public setClearColor(color: Color | number, alpha: number = 1.0): void {
        this.renderer.setClearColor(color, alpha);
    }

    /**
     * 清除缓冲区
     */
    public clear(): void {
        this.renderer.clear();
    }

    /**
     * 设置视口
     */
    public setViewport(x: number, y: number, width: number, height: number): void {
        this.renderer.setViewport(x, y, width, height);
    }

    /**
     * 设置裁剪区域
     */
    public setScissor(x: number, y: number, width: number, height: number): void {
        this.renderer.setScissor(x, y, width, height);
    }

    /**
     * 启用/禁用裁剪测试
     */
    public setScissorTest(enabled: boolean): void {
        this.renderer.setScissorTest(enabled);
    }

    /**
     * 获取 canvas 尺寸
     */
    public getSize(): { width: number; height: number } {
        return {
            width: this.renderer.domElement.width,
            height: this.renderer.domElement.height
        };
    }

    /**
     * 获取 domElement
     */
    public get domElement(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    /**
     * 获取/设置 autoClearColor
     */
    public get autoClearColor(): boolean {
        return this.renderer.autoClearColor;
    }

    public set autoClearColor(value: boolean) {
        this.renderer.autoClearColor = value;
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.renderer.dispose();
    }
}
