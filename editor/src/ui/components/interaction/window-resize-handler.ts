import { WindowContainer, WindowManager } from '../window';
import { InputEvent, EventTypes, GlobalInputManager } from '../../../engine';

export class WindowResizeHandler {
    private windowManager: WindowManager;
    private resizingWindow: WindowContainer | null = null;
    private resizeHandle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null = null;
    private resizeStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private windowStartBounds: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 0, height: 0 };
    private isResizing: boolean = false;
    
    // 全局事件取消订阅函数
    private unsubscribeMouseMove: (() => void) | null = null;
    private unsubscribeMouseUp: (() => void) | null = null;
    
    // 全局输入管理器
    private globalInputManager: GlobalInputManager;
    private attachedWindowIds: Set<string> = new Set();
    
    constructor(windowManager: WindowManager) {
        this.windowManager = windowManager;
        this.globalInputManager = GlobalInputManager.getInstance();
        this.windowManager.registerWindowAttacher((window: WindowContainer) => this.attachToWindow(window));
    }
    
    public attachToWindow(window: WindowContainer): void {
        if (this.attachedWindowIds.has(window.getId())) {
            return;
        }
        this.attachedWindowIds.add(window.getId());
        const inputManager = window.getInputManager();
        const element = window.getElement();
        
        // 创建调整大小的手柄
        const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        handles.forEach(handle => {
            const handleElement = document.createElement('div');
            handleElement.className = `window-resize-handle window-resize-handle-${handle}`;
            element.appendChild(handleElement);
            
            inputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
                if (event.target === handleElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.startResize(window, handle, event);
                }
            });
        });
    }
    
    private startResize(window: WindowContainer, handle: string, event: InputEvent): void {
        this.resizingWindow = window;
        this.resizeHandle = handle as any;
        this.isResizing = true;
        this.resizeStartPos = { x: event.globalPosition.x, y: event.globalPosition.y };
        const bounds = window.getBounds();
        this.windowStartBounds = { ...bounds };
        
        // 添加调整大小样式
        window.getElement().classList.add('resizing');
        
        // 聚焦窗口（resize 也算聚焦操作）
        this.windowManager.setFocusedWindow(window);
        
        // 订阅全局鼠标事件
        this.unsubscribeMouseMove = this.globalInputManager.onGlobalMouseMove((e: MouseEvent) => {
            this.handleGlobalMouseMove(e);
        });
        
        this.unsubscribeMouseUp = this.globalInputManager.onGlobalMouseUp((e: MouseEvent) => {
            this.handleGlobalMouseUp(e);
        });
    }
    
    private handleGlobalMouseMove(e: MouseEvent): void {
        if (!this.isResizing || !this.resizingWindow || !this.resizeHandle) return;
        
        const workspace = this.windowManager.getWorkspaceElement();
        const workspaceRect = workspace.getBoundingClientRect();
        
        // 检查鼠标是否在 workspace 范围内
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const isInWorkspace = mouseX >= workspaceRect.left && 
                              mouseX <= workspaceRect.right &&
                              mouseY >= workspaceRect.top && 
                              mouseY <= workspaceRect.bottom;
        
        if (!isInWorkspace) {
            // 超出 workspace 范围，结束调整
            this.endResize(e);
            return;
        }
        
        // 计算相对于 workspace 的坐标
        const relativeX = mouseX - workspaceRect.left;
        const relativeY = mouseY - workspaceRect.top;
        
        // 计算相对于起始位置的偏移
        const deltaX = relativeX - (this.resizeStartPos.x - workspaceRect.left);
        const deltaY = relativeY - (this.resizeStartPos.y - workspaceRect.top);
        
        let newX = this.windowStartBounds.x;
        let newY = this.windowStartBounds.y;
        let newWidth = this.windowStartBounds.width;
        let newHeight = this.windowStartBounds.height;
        
        // 根据手柄类型调整大小
        if (this.resizeHandle.includes('e')) {
            newWidth += deltaX;
        }
        if (this.resizeHandle.includes('w')) {
            newWidth -= deltaX;
            newX += deltaX;
        }
        if (this.resizeHandle.includes('s')) {
            newHeight += deltaY;
        }
        if (this.resizeHandle.includes('n')) {
            newHeight -= deltaY;
            newY += deltaY;
        }
        
        this.resizingWindow.setPosition(newX, newY);
        this.resizingWindow.setSize(newWidth, newHeight);
    }
    
    private handleGlobalMouseUp(e: MouseEvent): void {
        if (this.isResizing) {
            this.endResize(e);
        }
    }
    
    private endResize(_e?: MouseEvent): void {
        if (this.resizingWindow) {
            this.resizingWindow.getElement().classList.remove('resizing');
        }
        
        // 取消订阅全局事件
        this.cleanupGlobalSubscriptions();
        
        this.resizingWindow = null;
        this.resizeHandle = null;
        this.isResizing = false;
    }
    
    private cleanupGlobalSubscriptions(): void {
        if (this.unsubscribeMouseMove) {
            this.unsubscribeMouseMove();
            this.unsubscribeMouseMove = null;
        }
        if (this.unsubscribeMouseUp) {
            this.unsubscribeMouseUp();
            this.unsubscribeMouseUp = null;
        }
    }
    
    public dispose(): void {
        this.cleanupGlobalSubscriptions();
        if (this.resizingWindow) {
            this.resizingWindow.getElement().classList.remove('resizing');
            this.resizingWindow = null;
        }
        this.isResizing = false;
    }
}

