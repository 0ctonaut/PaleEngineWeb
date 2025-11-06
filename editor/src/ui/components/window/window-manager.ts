import { Window } from './window';
import { Panel } from './panel';
import { Viewport } from './viewport';

export class WindowManager {
    private workspaceElement!: HTMLElement;
    private windows: Window[] = [];
    private focusedWindow: Window | null = null;
    private baseZIndex: number = 1;
    private toolbarHeight: number = 40; // toolbar 高度
    
    constructor(container: HTMLElement) {
        this.createWorkspace(container);
        this.setupFocusManagement();
    }
    
    private createWorkspace(container: HTMLElement): void {
        this.workspaceElement = document.createElement('div');
        this.workspaceElement.className = 'window-workspace';
        container.appendChild(this.workspaceElement);
    }
    
    private setupFocusManagement(): void {
        // 点击 workspace 空白处取消聚焦
        this.workspaceElement.addEventListener('mousedown', (e) => {
            if (e.target === this.workspaceElement) {
                this.setFocusedWindow(null);
            }
        });
    }
    
    public addWindow(window: Window): void {
        this.windows.push(window);
        this.workspaceElement.appendChild(window.getElement());
        // 设置初始 z-index
        this.updateWindowZIndex(window);
    }
    
    public setFocusedWindow(window: Window | null): void {
        if (this.focusedWindow === window) return;
        
        // 移除之前的聚焦状态
        if (this.focusedWindow) {
            this.focusedWindow.getElement().classList.remove('window--active');
        }
        
        this.focusedWindow = window;
        
        // 设置新的聚焦状态
        if (window) {
            window.getElement().classList.add('window--active');
            this.bringToFront(window);
        }
    }
    
    public getFocusedWindow(): Window | null {
        return this.focusedWindow;
    }
    
    private bringToFront(window: Window): void {
        // 将所有窗口的 z-index 重置为基础值
        this.windows.forEach(w => {
            if (w !== window) {
                w.getElement().style.zIndex = `${this.baseZIndex}`;
            }
        });
        
        // 将被聚焦的窗口置于最前
        window.getElement().style.zIndex = `${this.baseZIndex + 1000}`;
    }
    
    private updateWindowZIndex(window: Window): void {
        if (window === this.focusedWindow) {
            this.bringToFront(window);
        } else {
            window.getElement().style.zIndex = `${this.baseZIndex}`;
        }
    }
    
    public getWorkspaceBounds(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
        const rect = this.workspaceElement.getBoundingClientRect();
        return {
            left: 0,
            top: 0,
            right: rect.width,
            bottom: rect.height,
            width: rect.width,
            height: rect.height
        };
    }
    
    public getToolbarHeight(): number {
        return this.toolbarHeight;
    }
    
    public removeWindow(window: Window): void {
        const index = this.windows.indexOf(window);
        if (index !== -1) {
            this.windows.splice(index, 1);
            if (window.getElement().parentNode === this.workspaceElement) {
                this.workspaceElement.removeChild(window.getElement());
            }
            
            // 如果移除的是聚焦窗口，取消聚焦
            if (this.focusedWindow === window) {
                this.focusedWindow = null;
            }
        }
    }
    
    public getWindows(): Window[] {
        return [...this.windows];
    }
    
    public getWorkspaceElement(): HTMLElement {
        return this.workspaceElement;
    }
    
    public createWindow(title: string, content: Panel | Viewport): Window {
        const window = new Window(title, content);
        window.setWindowManager(this);
        this.addWindow(window);
        return window;
    }
    
    public dispose(): void {
        this.windows.forEach(window => window.dispose());
        this.windows = [];
        
        if (this.workspaceElement.parentNode) {
            this.workspaceElement.parentNode.removeChild(this.workspaceElement);
        }
    }
}

