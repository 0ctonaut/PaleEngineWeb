import { WebGPURenderer, Scene, Camera, PerspectiveCamera } from 'three/webgpu';
import { ViewHelperGizmo, ViewDirection } from './view-helper-gizmo';
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
            size: 0.5,
            axisColors: {
                x: { color: 0xf90000, negativeSphere: 0x7f0000 },
                y: { color: 0x00f900, negativeSphere: 0x007f00 },
                z: { color: 0x0000f9, negativeSphere: 0x00007f }
            }
        });
    }

    public async render(renderer: WebGPURenderer, _scene?: Scene, _camera?: Camera): Promise<void> {
        if (!this.enabled) {
            return;
        }

        this.gizmo.syncWithCamera(this.camera.quaternion);

        const { x, y } = this.calculatePosition();

        renderer.setScissorTest(true);
        renderer.setScissor(x, y, this.config.size, this.config.size);
        renderer.setViewport(x, y, this.config.size, this.config.size);
        renderer.clearDepth();
        
        await this.gizmo.render(renderer);

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

    public shouldClear(): boolean {
        return true;
    }

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

    public handleClick(clientX: number, clientY: number): ViewDirection | null {
        const { x, y } = this.calculatePosition();
        const { size } = this.config;

        if (clientX >= x && clientX <= x + size &&
            clientY >= y && clientY <= y + size) {
            
            const localX = clientX - x;
            const localY = clientY - y;
            
            return this.gizmo.handleClick(localX, localY, size);
        }
        return null;
    }

    public handleHover(clientX: number, clientY: number): void {
        const { x, y } = this.calculatePosition();
        const { size } = this.config;

        if (clientX >= x && clientX <= x + size &&
            clientY >= y && clientY <= y + size) {
            
            const localX = clientX - x;
            const localY = clientY - y;
            
            this.gizmo.handleHover(localX, localY, size);
        } else {
            // Mouse is outside gizmo area, clear hover state
            this.gizmo.handleHover(-1, -1, size);
        }
    }
}

