import { Window } from './window';

export class Panel extends Window {
    private content: HTMLElement | null = null;

    constructor(title: string, content?: HTMLElement) {
        super(title);
        if (content) {
            this.setContent(content);
        }
    }

    protected buildContent(container: HTMLElement): void {
        container.classList.add('window-panel');
    }

    public setContent(content: HTMLElement): void {
        const host = this.getElement();
        if (this.content && this.content.parentNode === host) {
            host.removeChild(this.content);
        }
        this.content = content;
        host.appendChild(content);
    }

    public override dispose(): void {
        const host = this.getElement();
        if (this.content && this.content.parentNode === host) {
            host.removeChild(this.content);
        }
        this.content = null;
        super.dispose();
    }
}

