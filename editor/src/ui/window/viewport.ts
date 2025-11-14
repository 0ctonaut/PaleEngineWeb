import { BaseWindow } from './base-window';

export class Viewport extends BaseWindow {
    private canvas: HTMLCanvasElement | null = null;

    public constructor(title: string = 'Viewport', canvas?: HTMLCanvasElement) {
        super(title);
        this.setDefaultFloatingSize({ width: 640, height: 360 });
        if (canvas) {
            this.setCanvas(canvas);
        }
    }

    protected override onAttach(_container: HTMLElement): void {
        const element = this.getElement();
        element.classList.add('pale-window-viewport');
    }

    public setCanvas(canvas: HTMLCanvasElement): void {
        const host = this.getElement();
        if (this.canvas && this.canvas.parentNode === host) {
            host.removeChild(this.canvas);
        }
        this.canvas = canvas;
        host.appendChild(canvas);
    }

    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    public override dispose(): void {
        const host = this.getElement();
        if (this.canvas && this.canvas.parentNode === host) {
            host.removeChild(this.canvas);
        }
        this.canvas = null;
        super.dispose();
    }
}

