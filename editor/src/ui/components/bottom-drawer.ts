export abstract class BottomDrawer {
    protected tabHeader!: HTMLElement;
    protected content!: HTMLElement;
    protected toggleButton!: HTMLElement;
    protected isExpanded: boolean = false;
    
    constructor() {
        this.createTabHeader();
        this.createContent();
    }
    
    private createTabHeader(): void {
        this.tabHeader = document.createElement('div');
        this.tabHeader.className = 'tab-header';
        
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'tab-toggle';
        this.toggleButton.innerHTML = '↑';
        this.toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        this.tabHeader.appendChild(this.toggleButton);
    }
    
    private createContent(): void {
        this.content = document.createElement('div');
        this.content.className = 'tab-content';
    }
    
    public toggle(): void {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }
    
    public expand(): void {
        if (this.isExpanded) return;
        
        this.tabHeader.classList.add('active');
        this.toggleButton.textContent = '↓';
        this.isExpanded = true;
        
        this.onExpand();
    }
    
    public collapse(): void {
        if (!this.isExpanded) return;
        
        this.tabHeader.classList.remove('active');
        this.toggleButton.textContent = '↑';
        this.isExpanded = false;
        
        this.onCollapse();
    }
    
    protected onExpand(): void {
        // Override in subclass
    }
    
    protected onCollapse(): void {
        // Override in subclass
    }
    
    protected abstract renderContent(): void;
    
    protected abstract renderLabel(): void;
    
    public getTabHeader(): HTMLElement {
        return this.tabHeader;
    }
    
    public getContent(): HTMLElement {
        return this.content;
    }
    
    public getHeader(): HTMLElement {
        return this.tabHeader;
    }
    
    public isOpen(): boolean {
        return this.isExpanded;
    }
    
    public dispose(): void {
        if (this.tabHeader.parentNode) {
            this.tabHeader.parentNode.removeChild(this.tabHeader);
        }
        if (this.content.parentNode) {
            this.content.parentNode.removeChild(this.content);
        }
    }
}

