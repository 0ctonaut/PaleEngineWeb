import { Window } from './window';

export class Viewport extends Window {
    private canvas: HTMLCanvasElement | null = null;

    constructor(title: string = 'Viewport', canvas?: HTMLCanvasElement) {
        super(title);
        if (canvas) {
            this.setCanvas(canvas);
        }
    }

    protected buildContent(container: HTMLElement): void {
        container.classList.add('window-viewport');
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

