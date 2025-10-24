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
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // 创建弹窗
        this.modal = document.createElement('div');
        this.modal.className = 'modal';

        // 创建标题栏
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

        // 创建内容区域
        this.content = document.createElement('div');
        this.content.className = 'modal-content';

        this.modal.appendChild(this.header);
        this.modal.appendChild(this.content);

        this.overlay.appendChild(this.modal);
    }

    private bindEvents(): void {
        // 关闭按钮事件
        this.closeButton.addEventListener('click', () => this.hide());

        // 点击遮罩层关闭
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC 键关闭
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
        
        // 触发动画
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
        // 清理事件监听器
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.isVisible) {
            this.hide();
        }
    };
}
