import { Window, WindowContainer } from './window';

export interface WindowMovePayload {
    tabId: string;
    groupId: string;
    containerId: string;
    width: number;
    height: number;
}

export class 
WindowManager {
    private workspaceElement!: HTMLElement;
    private containers: WindowContainer[] = [];
    private containerMap: Map<string, WindowContainer> = new Map();
    private containerAttachers: Set<(container: WindowContainer) => void> = new Set();
    private focusedContainer: WindowContainer | null = null;
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
        this.workspaceElement.addEventListener('mousedown', (event) => {
            if (event.target === this.workspaceElement) {
                this.setFocusedContainer(null);
            }
        });
    }

    public registerWindowAttacher(attacher: (container: WindowContainer) => void): void {
        this.containerAttachers.add(attacher);
        this.containers.forEach(attacher);
    }

    public addWindow(window: Window): WindowContainer {
        const container = new WindowContainer(window);
        container.setWindowManager(this);
        this.containers.push(container);
        this.containerMap.set(container.getId(), container);
        this.workspaceElement.appendChild(container.getElement());
        this.updateContainerZIndex(container);
        this.containerAttachers.forEach(attacher => attacher(container));
        return container;
    }

    public setFocusedContainer(container: WindowContainer | null): void {
        if (this.focusedContainer === container) {
            return;
        }

        if (this.focusedContainer) {
            this.focusedContainer.getElement().classList.remove('window--active');
        }

        this.focusedContainer = container;

        if (container) {
            container.getElement().classList.add('window--active');
            this.bringToFront(container);
        }
    }

    public setFocusedWindow(container: WindowContainer | null): void {
        this.setFocusedContainer(container);
    }

    public getFocusedContainer(): WindowContainer | null {
        return this.focusedContainer;
    }

    private bringToFront(container: WindowContainer): void {
        this.containers.forEach(c => {
            if (c !== container) {
                c.getElement().style.zIndex = `${this.baseZIndex}`;
            }
        });
        container.getElement().style.zIndex = `${this.baseZIndex + 1000}`;
    }

    private updateContainerZIndex(container: WindowContainer): void {
        if (container === this.focusedContainer) {
            this.bringToFront(container);
        } else {
            container.getElement().style.zIndex = `${this.baseZIndex}`;
        }
    }

    public getWorkspaceBounds(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
        const rect = this.workspaceElement.getBoundingClientRect();
        const toolbarHeight = this.getToolbarHeight();
        const topOverlap = Math.max(0, toolbarHeight - rect.top);
        const effectiveHeight = Math.max(0, rect.height - topOverlap);

        return {
            left: 0,
            top: topOverlap,
            right: rect.width,
            bottom: topOverlap + effectiveHeight,
            width: rect.width,
            height: effectiveHeight
        };
    }

    public getToolbarHeight(): number {
        return this.toolbarHeight;
    }

    public removeContainer(container: WindowContainer): void {
        const index = this.containers.indexOf(container);
        if (index !== -1) {
            this.containers.splice(index, 1);
        }
        this.containerMap.delete(container.getId());
        if (container.getElement().parentNode === this.workspaceElement) {
            this.workspaceElement.removeChild(container.getElement());
        }
        if (this.focusedContainer === container) {
            this.focusedContainer = null;
        }
        container.dispose();
    }

    public moveWindowBetweenContainers(
        payload: WindowMovePayload,
        targetContainer: WindowContainer,
        targetGroupId: string,
        index: number
    ): void {
        const sourceContainer = this.containerMap.get(payload.containerId);
        if (!sourceContainer) {
            return;
        }
        const detachResult = sourceContainer.detachTab(payload.tabId);
        if (!detachResult) {
            return;
        }
        sourceContainer.markExternalTabDropHandled(payload.tabId);
        targetContainer.insertDetachedTab(detachResult.window, targetGroupId, index);
        if (detachResult.containerEmpty) {
            this.removeContainer(sourceContainer);
        }
        this.setFocusedContainer(targetContainer);
    }

    public spawnContainerFromDetachedWindow(
        window: Window,
        clientPos: { x: number; y: number },
        bounds: { width: number; height: number }
    ): WindowContainer {
        const container = this.addWindow(window);

        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const maxX = Math.max(0, workspaceRect.width - bounds.width);
        const maxY = Math.max(0, workspaceRect.height - bounds.height);
        const x = Math.min(Math.max(clientPos.x - workspaceRect.left - bounds.width / 2, 0), maxX);
        const y = Math.min(Math.max(clientPos.y - workspaceRect.top - bounds.height / 2, 0), maxY);
        container.setPosition(x, y);
        container.setSize(bounds.width, bounds.height);
        this.setFocusedContainer(container);
        return container;
    }

    public getContainers(): WindowContainer[] {
        return [...this.containers];
    }

    public getWindows(): WindowContainer[] {
        return this.getContainers();
    }

    public removeWindow(container: WindowContainer): void {
        this.removeContainer(container);
    }

    public moveTabBetweenWindows(
        payload: WindowMovePayload,
        targetContainer: WindowContainer,
        targetGroupId: string,
        index: number
    ): void {
        this.moveWindowBetweenContainers(payload, targetContainer, targetGroupId, index);
    }

    public spawnWindowFromDetachedTab(
        window: Window,
        clientPos: { x: number; y: number },
        bounds: { width: number; height: number }
    ): WindowContainer {
        return this.spawnContainerFromDetachedWindow(window, clientPos, bounds);
    }

    public createWindow(window: Window): WindowContainer {
        return this.addWindow(window);
    }

    public getWorkspaceElement(): HTMLElement {
        return this.workspaceElement;
    }

    public dispose(): void {
        this.containers.forEach(container => container.dispose());
        this.containers = [];

        if (this.workspaceElement.parentNode) {
            this.workspaceElement.parentNode.removeChild(this.workspaceElement);
        }
        this.containerMap.clear();
        this.containerAttachers.clear();
        this.focusedContainer = null;
    }
}

