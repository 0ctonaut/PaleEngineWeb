export class Panel {
    private element!: HTMLElement;
    private content: HTMLElement | null = null;
    
    constructor(content?: HTMLElement) {
        this.element = document.createElement('div');
        this.element.className = 'window-panel';
        
        if (content) {
            this.content = content;
            this.element.appendChild(content);
        }
    }
    
    public setContent(content: HTMLElement): void {
        if (this.content && this.content.parentNode === this.element) {
            this.element.removeChild(this.content);
        }
        this.content = content;
        this.element.appendChild(content);
    }
    
    public getElement(): HTMLElement {
        return this.element;
    }
    
    public dispose(): void {
        if (this.content && this.content.parentNode === this.element) {
            this.element.removeChild(this.content);
        }
        this.content = null;
    }
}

