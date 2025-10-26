export abstract class Modal {
    protected overlay!: HTMLElement;
    protected modal!: HTMLElement;
    protected header!: HTMLElement;
    protected content!: HTMLElement;
    protected closeButton!: HTMLElement;
    protected isVisible: boolean = false;

    constructor(title: string) {
        this.createModal(title);
        this.bindEvents();
    }

    private createModal(title: string): void {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // Create modal
        this.modal = document.createElement('div');
        this.modal.className = 'modal';

        // Create title bar
        this.header = document.createElement('div');
        this.header.className = 'modal-header';

        const titleElement = document.createElement('h3');
        titleElement.className = 'modal-title';
        titleElement.textContent = title;

        this.closeButton = document.createElement('button');
        this.closeButton.className = 'modal-close';
        this.closeButton.setAttribute('aria-label', 'Close');

        this.header.appendChild(titleElement);
        this.header.appendChild(this.closeButton);

        // Create content area
        this.content = document.createElement('div');
        this.content.className = 'modal-content';

        this.modal.appendChild(this.header);
        this.modal.appendChild(this.content);

        this.overlay.appendChild(this.modal);
    }

    private bindEvents(): void {
        // Close button event
        this.closeButton.addEventListener('click', () => this.hide());

        // Click overlay to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    protected abstract renderContent(): void;

    public show(): void {
        if (this.isVisible) return;

        this.renderContent();
        document.body.appendChild(this.overlay);
        
        // Trigger animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('show');
        });

        this.isVisible = true;
    }

    public hide(): void {
        if (!this.isVisible) return;

        this.overlay.classList.remove('show');
        
        setTimeout(() => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }, 200);

        this.isVisible = false;
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    public dispose(): void {
        this.hide();
        // Clean up event listeners
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    };
}
