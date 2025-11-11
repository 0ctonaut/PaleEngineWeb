import { WindowContainer, WindowManager } from '../window';
import { InputEvent, EventTypes, GlobalInputManager } from '../../../engine';

export class WindowDragHandler {
    private windowManager: WindowManager;
    private draggingWindow: WindowContainer | null = null;
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
    private edgeDockThresholdRatio: number = 0.1; // 靠近边缘 10% 进入预吸附
    private edgeDockThresholdRatioMax: number = 0.2; // 靠近边缘 10% 进入预吸附
    private dockPreviewElement: HTMLElement | null = null;
    private attachedWindowIds: Set<string> = new Set();
    
    constructor(windowManager: WindowManager) {
        this.windowManager = windowManager;
        this.globalInputManager = GlobalInputManager.getInstance();
        this.windowManager.registerWindowAttacher((container: WindowContainer) => this.attachToWindow(container));
    }
    
    public attachToWindow(window: WindowContainer): void {
        if (this.attachedWindowIds.has(window.getId())) {
            return;
        }
        this.attachedWindowIds.add(window.getId());
        const inputManager = window.getInputManager();
        inputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
            if (!event.target) return;
            if (!window.shouldStartWindowDragFrom(event.target)) return;
            if (typeof event.button === 'number' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            this.startDrag(window, event);
        });
    }
    
    private startDrag(window: WindowContainer, event: InputEvent): void {
        this.draggingWindow = window;
        this.isDragging = true;
        this.dragStartPos = { x: event.globalPosition.x, y: event.globalPosition.y };
        const bounds = window.getBounds();
        this.windowStartPos = { x: bounds.x, y: bounds.y };

        if (window.isDockedWindow()) {
            window.setDockedState(false);
        }
        
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
        
        const workspaceRect = this.cachedWorkspaceRect;
        
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        
        // 计算相对于 workspace 的坐标
        const relativeX = mouseX - workspaceRect.left;
        const relativeY = mouseY - workspaceRect.top;
        
        // 计算新位置
        const deltaX = relativeX - (this.dragStartPos.x - workspaceRect.left);
        const deltaY = relativeY - (this.dragStartPos.y - workspaceRect.top);
        
        const newX = this.windowStartPos.x + deltaX;
        const newY = this.windowStartPos.y + deltaY;
        
        this.draggingWindow.setPosition(newX, newY);

        const edgeDock = this.checkEdgeDock({ x: relativeX, y: relativeY }, workspaceRect, this.draggingWindow);
        if (edgeDock) {
            this.showEdgeDockPreview(edgeDock.edge, workspaceRect);
        } else {
            this.hideEdgeDockPreview();
        }
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
        
        this.hideEdgeDockPreview();

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
        const edgeDock = this.checkEdgeDock(mousePos, workspaceRect, this.draggingWindow);
        if (edgeDock) {
            this.dockWindowToEdge(edgeDock.edge, workspaceRect);
            this.hideEdgeDockPreview();
            return;
        }

        this.draggingWindow.setDockedState(false);
        
        // 检测窗口拆分
        const windowSplit = this.checkWindowSplit(globalMousePos);
        if (windowSplit) {
            // TODO: 实现窗口拆分
            return;
        }
    }
    
    private checkEdgeDock(mousePos: { x: number; y: number }, workspaceRect: DOMRect, draggingWindow: WindowContainer | null): { edge: 'top' | 'bottom' | 'left' | 'right' } | null {
        const { x, y } = mousePos;
        const metrics = this.getDockMetrics(workspaceRect, draggingWindow);

        const distances: Array<{ edge: 'top' | 'bottom' | 'left' | 'right'; distance: number }> = [];

        const leftDistance = x;
        const rightDistance = workspaceRect.width - x;
        const normalizedY = Math.max(0, y - metrics.topOverlap);
        const topDistance = normalizedY;
        const bottomDistance = Math.max(0, metrics.availableHeight - normalizedY);

        if (leftDistance <= metrics.horizontalThreshold) {
            distances.push({ edge: 'left', distance: leftDistance });
        }
        if (rightDistance <= metrics.horizontalThreshold) {
            distances.push({ edge: 'right', distance: rightDistance });
        }
        if (metrics.availableHeight > 0 && topDistance <= metrics.verticalThreshold) {
            distances.push({ edge: 'top', distance: topDistance });
        }
        if (metrics.availableHeight > 0 && bottomDistance <= metrics.verticalThreshold) {
            distances.push({ edge: 'bottom', distance: bottomDistance });
        }

        if (distances.length === 0) {
            return null;
        }

        distances.sort((a, b) => a.distance - b.distance);
        return { edge: distances[0].edge };
    }

    private showEdgeDockPreview(edge: 'top' | 'bottom' | 'left' | 'right', workspaceRect: DOMRect): void {
        const workspace = this.windowManager.getWorkspaceElement();
        if (!this.dockPreviewElement) {
            this.dockPreviewElement = document.createElement('div');
            this.dockPreviewElement.className = 'window-dock-preview';
            workspace.appendChild(this.dockPreviewElement);
        }

        const targetRect = this.getDockRect(edge, workspaceRect, this.draggingWindow);
        this.dockPreviewElement.style.left = `${targetRect.x}px`;
        this.dockPreviewElement.style.top = `${targetRect.y}px`;
        this.dockPreviewElement.style.width = `${targetRect.width}px`;
        this.dockPreviewElement.style.height = `${targetRect.height}px`;
        this.dockPreviewElement.style.display = 'block';
    }

    private hideEdgeDockPreview(): void {
        if (this.dockPreviewElement && this.dockPreviewElement.parentNode) {
            this.dockPreviewElement.parentNode.removeChild(this.dockPreviewElement);
        }
        this.dockPreviewElement = null;
    }

    private dockWindowToEdge(edge: 'top' | 'bottom' | 'left' | 'right', workspaceRect: DOMRect): void {
        if (!this.draggingWindow) return;

        this.draggingWindow.setDockedState(true, edge);
        const targetRect = this.getDockRect(edge, workspaceRect, this.draggingWindow);
        this.draggingWindow.setPosition(targetRect.x, targetRect.y);
        this.draggingWindow.setSize(targetRect.width, targetRect.height);
    }

    private getDockRect(edge: 'top' | 'bottom' | 'left' | 'right', workspaceRect: DOMRect, draggingWindow: WindowContainer | null): { x: number; y: number; width: number; height: number } {
        if (draggingWindow == null) {
            return {
                x: 0,
                y: 0,
                width: 0,
                height: 0
            };
        }

        const metrics = this.getDockMetrics(workspaceRect, draggingWindow);
        const horizontalDockWidth = metrics.horizontalThreshold;
        const verticalDockHeight = metrics.verticalThreshold;

        switch (edge) {
            case 'top':
                return {
                    x: 0,
                    y: metrics.topOverlap,
                    width: metrics.availableWidth,
                    height: verticalDockHeight
                };
            case 'bottom':
                return {
                    x: 0,
                    y: metrics.topOverlap + Math.max(0, metrics.availableHeight - verticalDockHeight),
                    width: metrics.availableWidth,
                    height: verticalDockHeight
                };
            case 'left':
                return {
                    x: 0,
                    y: metrics.topOverlap,
                    width: horizontalDockWidth,
                    height: metrics.availableHeight
                };
            case 'right':
            default:
                return {
                    x: Math.max(0, metrics.availableWidth - horizontalDockWidth),
                    y: metrics.topOverlap,
                    width: horizontalDockWidth,
                    height: metrics.availableHeight
                };
        }
    }

    private getDockMetrics(workspaceRect: DOMRect, draggingWindow: WindowContainer | null) {
        const toolbarHeight = typeof (this.windowManager as any).getToolbarHeight === 'function'
            ? this.windowManager.getToolbarHeight()
            : 0;
        const topOverlap = Math.max(0, toolbarHeight - workspaceRect.top);
        const availableWidth = Math.max(0, workspaceRect.width);
        const availableHeight = Math.max(0, workspaceRect.height - topOverlap);

        const windowBounds = draggingWindow?.getBounds();
        const windowWidth = windowBounds ? windowBounds.width : 0;
        const windowHeight = windowBounds ? windowBounds.height : 0;

        const baseHorizontal = workspaceRect.width * this.edgeDockThresholdRatio;
        const baseVertical = availableHeight * this.edgeDockThresholdRatio;

        const horizontalThreshold = Math.min(
            Math.max(baseHorizontal, windowWidth),
            availableWidth * this.edgeDockThresholdRatioMax
        );
        const verticalThreshold = Math.min(
            Math.max(baseVertical, windowHeight),
            availableHeight * this.edgeDockThresholdRatioMax,
            availableHeight
        );

        return {
            topOverlap,
            availableWidth,
            availableHeight,
            horizontalThreshold,
            verticalThreshold
        };
    }
    
    private checkWindowSplit(mousePos: { x: number; y: number }): { window: WindowContainer; direction: 'horizontal' | 'vertical' } | null {
        const windows = this.windowManager.getContainers();
        
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

