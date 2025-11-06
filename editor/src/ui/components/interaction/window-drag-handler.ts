import { Window } from '../window/window';
import { WindowManager } from '../window/window-manager';
import { InputEvent, EventTypes, GlobalInputManager } from '../../../engine/input';

export class WindowDragHandler {
    private windowManager: WindowManager;
    private draggingWindow: Window | null = null;
    private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private windowStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private isDragging: boolean = false;
    
    // 缓存的 workspace 矩形（拖拽开始时获取一次）
    private cachedWorkspaceRect: DOMRect | null = null;
    
    // 全局事件取消订阅函数
    private unsubscribeMouseMove: (() => void) | null = null;
    private unsubscribeMouseUp: (() => void) | null = null;
    
    // 全局输入管理器
    private globalInputManager: GlobalInputManager;
    
    // 吸附相关
    private edgeDockThreshold: number = 50;
    private tabMergeThreshold: number = 30;
    
    constructor(windowManager: WindowManager) {
        this.windowManager = windowManager;
        this.globalInputManager = GlobalInputManager.getInstance();
    }
    
    public attachToWindow(window: Window): void {
        const inputManager = window.getInputManager();
        const titleTab = window.getElement().querySelector('.window-title-tab') as HTMLElement;
        
        if (!titleTab) return;
        
        // 鼠标按下
        inputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
            if (window.getContentType() === 'single' && event.target && titleTab.contains(event.target)) {
                event.preventDefault();
                event.stopPropagation();
                this.startDrag(window, event);
            }
        });
    }
    
    private startDrag(window: Window, event: InputEvent): void {
        this.draggingWindow = window;
        this.isDragging = true;
        this.dragStartPos = { x: event.globalPosition.x, y: event.globalPosition.y };
        const bounds = window.getBounds();
        this.windowStartPos = { x: bounds.x, y: bounds.y };
        
        // 缓存 workspace 矩形（只在开始时获取一次）
        const workspace = this.windowManager.getWorkspaceElement();
        this.cachedWorkspaceRect = workspace.getBoundingClientRect();
        
        // 添加拖拽样式
        window.getElement().classList.add('dragging');
        
        // 聚焦窗口
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
        if (!this.isDragging || !this.draggingWindow || !this.cachedWorkspaceRect) return;
        
        // 使用缓存的 workspace 矩形
        const workspaceRect = this.cachedWorkspaceRect;
        
        // 检查鼠标是否在 workspace 范围内
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        const isInWorkspace = mouseX >= workspaceRect.left && 
                              mouseX <= workspaceRect.right &&
                              mouseY >= workspaceRect.top && 
                              mouseY <= workspaceRect.bottom;
        
        if (!isInWorkspace) {
            // 超出 workspace 范围，结束拖拽
            this.endDrag(e);
            return;
        }
        
        // 计算相对于 workspace 的坐标
        const relativeX = mouseX - workspaceRect.left;
        const relativeY = mouseY - workspaceRect.top;
        
        // 计算新位置
        const deltaX = relativeX - (this.dragStartPos.x - workspaceRect.left);
        const deltaY = relativeY - (this.dragStartPos.y - workspaceRect.top);
        
        const newX = this.windowStartPos.x + deltaX;
        const newY = this.windowStartPos.y + deltaY;
        
        this.draggingWindow.setPosition(newX, newY);
    }
    
    private handleGlobalMouseUp(e: MouseEvent): void {
        if (this.isDragging) {
            this.endDrag(e);
        }
    }
    
    private endDrag(e: MouseEvent): void {
        if (!this.draggingWindow) return;
        
        // 移除拖拽样式
        this.draggingWindow.getElement().classList.remove('dragging');
        
        // 执行吸附操作（需要重新获取 workspaceRect，因为可能已经变化）
        const workspace = this.windowManager.getWorkspaceElement();
        const workspaceRect = workspace.getBoundingClientRect();
        this.performDock({ 
            x: e.clientX - workspaceRect.left, 
            y: e.clientY - workspaceRect.top 
        });
        
        // 清理缓存的 workspace 矩形
        this.cachedWorkspaceRect = null;
        
        // 取消订阅全局事件
        this.cleanupGlobalSubscriptions();
        
        this.draggingWindow = null;
        this.isDragging = false;
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
    
    private performDock(mousePos: { x: number; y: number }): void {
        if (!this.draggingWindow) return;
        
        const workspace = this.windowManager.getWorkspaceElement();
        const workspaceRect = workspace.getBoundingClientRect();
        
        // 将鼠标位置转换为全局坐标
        const globalMousePos = {
            x: mousePos.x + workspaceRect.left,
            y: mousePos.y + workspaceRect.top
        };
        
        // 检测边缘吸附
        const edgeDock = this.checkEdgeDock(mousePos, workspaceRect);
        if (edgeDock) {
            // TODO: 实现边缘吸附
            return;
        }
        
        // 检测标签页合并
        const tabMerge = this.checkTabMerge(globalMousePos);
        if (tabMerge) {
            // TODO: 实现标签页合并
            return;
        }
        
        // 检测窗口拆分
        const windowSplit = this.checkWindowSplit(globalMousePos);
        if (windowSplit) {
            // TODO: 实现窗口拆分
            return;
        }
    }
    
    private checkEdgeDock(mousePos: { x: number; y: number }, workspaceRect: DOMRect): { edge: 'top' | 'bottom' | 'left' | 'right' } | null {
        const { x, y } = mousePos;
        
        if (Math.abs(x - 0) < this.edgeDockThreshold) {
            return { edge: 'left' };
        }
        if (Math.abs(x - workspaceRect.width) < this.edgeDockThreshold) {
            return { edge: 'right' };
        }
        if (Math.abs(y - 0) < this.edgeDockThreshold) {
            return { edge: 'top' };
        }
        if (Math.abs(y - workspaceRect.height) < this.edgeDockThreshold) {
            return { edge: 'bottom' };
        }
        
        return null;
    }
    
    private checkTabMerge(mousePos: { x: number; y: number }): Window | null {
        const windows = this.windowManager.getWindows();
        
        for (const window of windows) {
            if (window === this.draggingWindow) continue;
            if (window.getContentType() !== 'single') continue;
            
            const titleTab = window.getElement().querySelector('.window-title-tab') as HTMLElement;
            if (!titleTab) continue;
            
            const rect = titleTab.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(mousePos.x - (rect.left + rect.width / 2), 2) +
                Math.pow(mousePos.y - (rect.top + rect.height / 2), 2)
            );
            
            if (distance < this.tabMergeThreshold) {
                return window;
            }
        }
        
        return null;
    }
    
    private checkWindowSplit(mousePos: { x: number; y: number }): { window: Window; direction: 'horizontal' | 'vertical' } | null {
        const windows = this.windowManager.getWindows();
        
        for (const window of windows) {
            if (window === this.draggingWindow) continue;
            
            const element = window.getElement();
            const contentArea = element.querySelector('.window-content') as HTMLElement;
            if (!contentArea) continue;
            
            const rect = contentArea.getBoundingClientRect();
            if (mousePos.x >= rect.left && mousePos.x <= rect.right &&
                mousePos.y >= rect.top && mousePos.y <= rect.bottom) {
                
                // 判断拆分方向
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const direction = Math.abs(mousePos.x - centerX) > Math.abs(mousePos.y - centerY)
                    ? 'horizontal'
                    : 'vertical';
                
                return { window, direction };
            }
        }
        
        return null;
    }
    
    public dispose(): void {
        this.cleanupGlobalSubscriptions();
        if (this.draggingWindow) {
            this.draggingWindow.getElement().classList.remove('dragging');
            this.draggingWindow = null;
        }
        this.isDragging = false;
    }
}

