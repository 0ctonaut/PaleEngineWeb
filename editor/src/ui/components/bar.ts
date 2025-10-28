import { BottomDrawer } from './bottom-drawer';

export interface BarOptions {
    position: 'top' | 'bottom';
    mode: 'follow' | 'fixed';
}

export abstract class Bar {
    protected container!: HTMLElement;
    protected tabsContainer!: HTMLElement;
    protected contentContainer!: HTMLElement;
    protected tabs: BottomDrawer[] = [];
    protected currentExpandedTab: BottomDrawer | null = null;
    protected position: 'top' | 'bottom';
    protected mode: 'follow' | 'fixed';
    
    constructor(options: BarOptions) {
        this.position = options.position;
        this.mode = options.mode;
        this.createBar();
        this.bindEvents();
    }
    
    protected createBar(): void {
        this.container = document.createElement('div');
        this.container.className = `bar bar-${this.position} mode-${this.mode}`;
        
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'bar-tabs';
        
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'bar-content';
        this.contentContainer.style.display = 'none';
        
        this.container.appendChild(this.tabsContainer);
        this.container.appendChild(this.contentContainer);
    }
    
    protected bindEvents(): void {
        document.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const tabHeader = target.closest('.tab-header');
            if (tabHeader) {
                const index = Array.from(this.tabsContainer.children).indexOf(tabHeader);
                if (index !== -1) {
                    this.tabs[index].toggle();
                }
            }
        });
    }
    
    public addTab(tab: BottomDrawer): void {
        const tabHeader = tab.getTabHeader();
        if (!tabHeader) {
            console.warn('Tab does not have a header element');
            return;
        }
        
        this.tabsContainer.appendChild(tabHeader);
        
        const tabContent = tab.getContent();
        tabContent.style.display = 'none';
        this.contentContainer.appendChild(tabContent);
        
        this.tabs.push(tab);
        this.setupTabEvents(tab);
    }
    
    protected setupTabEvents(tab: BottomDrawer): void {
        const originalExpand = tab.expand.bind(tab);
        (tab as any).expand = () => {
            if (this.currentExpandedTab && this.currentExpandedTab !== tab) {
                this.currentExpandedTab.collapse();
            }
            
            this.currentExpandedTab = tab;
            originalExpand();
            
            tab.getContent().style.display = 'block';
            this.contentContainer.style.display = 'block';
            
            if (this.mode === 'follow') {
                this.container.classList.add('expanded');
            }
        };
        
        const originalCollapse = tab.collapse.bind(tab);
        (tab as any).collapse = () => {
            originalCollapse();
            
            tab.getContent().style.display = 'none';
            
            if (this.currentExpandedTab === tab) {
                this.currentExpandedTab = null;
            }
            
            if (this.currentExpandedTab === null) {
                this.contentContainer.style.display = 'none';
                if (this.mode === 'follow') {
                    this.container.classList.remove('expanded');
                }
            }
        };
        tab.collapse();
    }
    
    public setMode(mode: 'follow' | 'fixed'): void {
        this.container.classList.remove(`mode-${this.mode}`);
        this.mode = mode;
        this.container.classList.add(`mode-${mode}`);
    }
    
    public getElement(): HTMLElement {
        return this.container;
    }
    
    public getTabsContainer(): HTMLElement {
        return this.tabsContainer;
    }
    
    public getContentContainer(): HTMLElement {
        return this.contentContainer;
    }
    
    public dispose(): void {
        this.tabs.forEach(tab => tab.dispose());
        this.tabs = [];
        
        if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}
