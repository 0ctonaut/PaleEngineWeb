export class Viewport {
    private element!: HTMLElement;
    private canvas: HTMLCanvasElement | null = null;
    
    constructor(canvas?: HTMLCanvasElement) {
        this.element = document.createElement('div');
        this.element.className = 'window-viewport';
        
        if (canvas) {
            this.setCanvas(canvas);
        }
    }
    
    public setCanvas(canvas: HTMLCanvasElement): void {
        if (this.canvas && this.canvas.parentNode === this.element) {
            this.element.removeChild(this.canvas);
        }
        this.canvas = canvas;
        this.element.appendChild(canvas);
    }
    
    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }
    
    public getElement(): HTMLElement {
        return this.element;
    }
    
    public dispose(): void {
        if (this.canvas && this.canvas.parentNode === this.element) {
            this.element.removeChild(this.canvas);
        }
        this.canvas = null;
    }
}

