import { LocalInputManager, InputContext, EventTypes } from '../../../engine/input';
import { Panel } from './panel';
import { Viewport } from './viewport';

export type WindowContentType = 'single' | 'split' | 'tab';
export type SplitDirection = 'horizontal' | 'vertical';

export interface WindowContent {
    panel?: Panel;
    viewport?: Viewport;
}

export interface SplitContent {
    direction: SplitDirection;
    ratio: number; // 0-1, 分割比例
    leftWindow: Window;
    rightWindow: Window;
}

export interface TabContent {
    tabs: Window[];
    activeTabIndex: number;
}

export class Window {
    private element!: HTMLElement;
    private titleTab!: HTMLElement;
    private contentArea!: HTMLElement;
    private contentType: WindowContentType = 'single';
    private content: WindowContent | SplitContent | TabContent | null = null;
    
    // 位置和大小
    private x: number = 100;
    private y: number = 100;
    private width: number = 800;
    private height: number = 600;
    private minWidth: number = 200;
    private minHeight: number = 150;
    
    // Input 系统
    private inputManager!: LocalInputManager;
    private inputContext!: InputContext;
    
    // 父窗口引用
    private parentWindow: Window | null = null;
    
    // 窗口管理器引用
    private windowManager: any | null = null; // 使用 any 避免循环依赖
    
    // 标题
    private title: string = '';
    
    constructor(
        title: string,
        content: Panel | Viewport,
        parent?: Window
    ) {
        this.title = title;
        this.parentWindow = parent || null;
        this.content = { panel: content instanceof Panel ? content : undefined, viewport: content instanceof Viewport ? content : undefined };
        this.createWindow();
        this.setupInput();
    }
    
    private createWindow(): void {
        this.element = document.createElement('div');
        this.element.className = 'window';
        
        // 创建标题标签（仅当 contentType === 'single' 时显示）
        this.titleTab = document.createElement('div');
        this.titleTab.className = 'window-title-tab';
        this.titleTab.textContent = this.title;
        
        // 创建内容区
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'window-content';
        
        this.element.appendChild(this.titleTab);
        this.element.appendChild(this.contentArea);
        
        this.updateLayout();
        this.renderContent();
    }
    
    private setupInput(): void {
        // 创建 InputContext
        this.inputContext = new InputContext({ name: 'window', priority: 100 });
        
        // 创建 LocalInputManager
        this.inputManager = new LocalInputManager(this.element, this.inputContext, {
            parent: this.parentWindow?.inputManager || undefined
        });
        
        // 添加点击事件处理聚焦
        this.inputManager.on(EventTypes.MOUSE_DOWN, () => {
            // 点击窗口任何地方都会聚焦
            if (this.windowManager && this.contentType === 'single') {
                this.windowManager.setFocusedWindow(this);
            }
        });
    }
    
    public setWindowManager(manager: any | null): void {
        this.windowManager = manager;
    }
    
    private updateLayout(): void {
        // 更新大小
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        
        // 拖拽时使用 transform（更流畅），非拖拽时使用 left/top（保持布局稳定）
        const isDragging = this.element.classList.contains('dragging');
        if (isDragging) {
            // 拖拽时使用 transform
            this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
            this.element.style.left = '0';
            this.element.style.top = '0';
        } else {
            // 非拖拽时使用 left/top
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
            this.element.style.transform = '';
        }
        
        // 更新标题标签显示
        if (this.contentType === 'single') {
            this.titleTab.style.display = 'block';
        } else {
            this.titleTab.style.display = 'none';
        }
    }
    
    private renderContent(): void {
        this.contentArea.innerHTML = '';
        
        if (this.contentType === 'single') {
            const content = this.content as WindowContent;
            if (content.panel) {
                this.contentArea.appendChild(content.panel.getElement());
            } else if (content.viewport) {
                this.contentArea.appendChild(content.viewport.getElement());
            }
        } else if (this.contentType === 'split') {
            const split = this.content as SplitContent;
            // 创建分割布局
            const splitContainer = document.createElement('div');
            splitContainer.className = `window-split window-split-${split.direction}`;
            
            const leftPane = document.createElement('div');
            leftPane.className = 'window-split-pane window-split-pane-left';
            leftPane.style.width = split.direction === 'horizontal' ? `${split.ratio * 100}%` : '100%';
            leftPane.style.height = split.direction === 'vertical' ? `${split.ratio * 100}%` : '100%';
            
            const rightPane = document.createElement('div');
            rightPane.className = 'window-split-pane window-split-pane-right';
            rightPane.style.width = split.direction === 'horizontal' ? `${(1 - split.ratio) * 100}%` : '100%';
            rightPane.style.height = split.direction === 'vertical' ? `${(1 - split.ratio) * 100}%` : '100%';
            
            const splitter = document.createElement('div');
            splitter.className = 'window-splitter';
            
            leftPane.appendChild(split.leftWindow.getElement());
            rightPane.appendChild(split.rightWindow.getElement());
            
            splitContainer.appendChild(leftPane);
            splitContainer.appendChild(splitter);
            splitContainer.appendChild(rightPane);
            
            this.contentArea.appendChild(splitContainer);
        } else if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            // 创建标签页布局
            const tabContainer = document.createElement('div');
            tabContainer.className = 'window-tab-container';
            
            const tabBar = document.createElement('div');
            tabBar.className = 'window-tab-bar';
            
            tabs.tabs.forEach((tab, index) => {
                const tabElement = document.createElement('div');
                tabElement.className = `window-tab ${index === tabs.activeTabIndex ? 'active' : ''}`;
                tabElement.textContent = tab.getTitle();
                tabElement.addEventListener('click', () => {
                    this.setActiveTab(index);
                });
                tabBar.appendChild(tabElement);
            });
            
            const tabContent = document.createElement('div');
            tabContent.className = 'window-tab-content';
            if (tabs.tabs[tabs.activeTabIndex]) {
                tabContent.appendChild(tabs.tabs[tabs.activeTabIndex].getElement());
            }
            
            tabContainer.appendChild(tabBar);
            tabContainer.appendChild(tabContent);
            
            this.contentArea.appendChild(tabContainer);
        }
    }
    
    public setContentType(type: WindowContentType): void {
        this.contentType = type;
        this.updateLayout();
        this.renderContent();
    }
    
    public setSplitContent(direction: SplitDirection, leftWindow: Window, rightWindow: Window, ratio: number = 0.5): void {
        this.contentType = 'split';
        this.content = {
            direction,
            ratio,
            leftWindow,
            rightWindow
        };
        leftWindow.setParent(this);
        rightWindow.setParent(this);
        this.updateLayout();
        this.renderContent();
    }
    
    public setTabContent(tabs: Window[], activeIndex: number = 0): void {
        this.contentType = 'tab';
        this.content = {
            tabs,
            activeTabIndex: activeIndex
        };
        tabs.forEach(tab => tab.setParent(this));
        this.updateLayout();
        this.renderContent();
    }
    
    public setActiveTab(index: number): void {
        if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            if (index >= 0 && index < tabs.tabs.length) {
                tabs.activeTabIndex = index;
                this.renderContent();
            }
        }
    }
    
    public addTab(window: Window): void {
        if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            tabs.tabs.push(window);
            window.setParent(this);
            this.renderContent();
        }
    }
    
    public removeTab(window: Window): void {
        if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            const index = tabs.tabs.indexOf(window);
            if (index !== -1) {
                tabs.tabs.splice(index, 1);
                if (tabs.activeTabIndex >= tabs.tabs.length) {
                    tabs.activeTabIndex = Math.max(0, tabs.tabs.length - 1);
                }
                window.setParent(null);
                this.renderContent();
            }
        }
    }
    
    public setParent(parent: Window | null): void {
        this.parentWindow = parent;
        if (this.inputManager) {
            // 更新 input manager 的父级关系
            // 这里需要重新创建 input manager 或更新其父级
            // 简化实现：暂时保持原样，后续优化
        }
    }
    
    public setPosition(x: number, y: number): void {
        // 如果窗口在 workspace 中，应用边界约束
        if (this.windowManager) {
            const bounds = this.windowManager.getWorkspaceBounds();
            
            // 约束 x：左边缘不能小于 0，右边缘不能超出 workspace 宽度
            x = Math.max(0, Math.min(x, bounds.width - this.width));
            
            // 约束 y：上边缘不能小于 0（注意 workspace 从顶部开始，toolbar 在上面）
            y = Math.max(0, Math.min(y, bounds.height - this.height));
        }
        
        this.x = x;
        this.y = y;
        this.updateLayout();
    }
    
    public setSize(width: number, height: number): void {
        this.width = Math.max(width, this.minWidth);
        this.height = Math.max(height, this.minHeight);
        this.updateLayout();
        
        // 递归调整子窗口
        this.resizeChildren();
    }
    
    private resizeChildren(): void {
        if (this.contentType === 'split') {
            const split = this.content as SplitContent;
            // 子窗口会自动通过 CSS 布局调整，但需要递归调整
            split.leftWindow.resizeChildren();
            split.rightWindow.resizeChildren();
        } else if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            tabs.tabs.forEach(tab => {
                tab.setSize(this.width, this.height);
                tab.resizeChildren();
            });
        }
    }
    
    public getElement(): HTMLElement {
        return this.element;
    }
    
    public getTitle(): string {
        return this.title;
    }
    
    public setTitle(title: string): void {
        this.title = title;
        this.titleTab.textContent = title;
    }
    
    public getContentType(): WindowContentType {
        return this.contentType;
    }
    
    public getContent(): WindowContent | SplitContent | TabContent | null {
        return this.content;
    }
    
    public getInputManager(): LocalInputManager {
        return this.inputManager;
    }
    
    public getInputContext(): InputContext {
        return this.inputContext;
    }
    
    public getBounds(): { x: number; y: number; width: number; height: number } {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    public dispose(): void {
        if (this.inputManager) {
            this.inputManager.dispose();
        }
        
        if (this.contentType === 'split') {
            const split = this.content as SplitContent;
            split.leftWindow.dispose();
            split.rightWindow.dispose();
        } else if (this.contentType === 'tab') {
            const tabs = this.content as TabContent;
            tabs.tabs.forEach(tab => tab.dispose());
        } else if (this.contentType === 'single') {
            const content = this.content as WindowContent;
            if (content.panel) {
                content.panel.dispose();
            } else if (content.viewport) {
                content.viewport.dispose();
            }
        }
        
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

