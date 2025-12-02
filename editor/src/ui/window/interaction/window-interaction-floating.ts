import {
    DockSide,
    DockingPreview,
    DockingScope,
    DragSession,
    InteractionHost,
    PointerState,
    PositionHint
} from './window-interaction-shared';
import { WindowTreeStore } from '../window-tree-store';
import { FloatingWindowDescriptor, SplitDirection, TabContainerNode } from '../types';
import { InputEvent } from '../../../engine';

const TAB_REORDER_VERTICAL_MARGIN = 14;

interface FloatingDragContext {
    descriptor: FloatingWindowDescriptor;
    element: HTMLElement;
    startPointer: { x: number; y: number };
    startPosition: { x: number; y: number };
}

interface FloatingResizeContext {
    descriptor: FloatingWindowDescriptor;
    element: HTMLElement;
    handle: string;
    startPointer: { x: number; y: number };
    startBounds: { x: number; y: number; width: number; height: number };
    workspaceRect: DOMRect;
}

interface FloatingTabDragContext extends PointerState {
    nodeId: string;
    containerId: string;
    tabBar: HTMLElement;
    tabBarRect: DOMRect;
    detached: boolean;
}

export class FloatingInteraction {
    private readonly store: WindowTreeStore;
    private readonly workspaceElement: HTMLElement;

    private floatingDragCtx: FloatingDragContext | null = null;
    private floatingResizeCtx: FloatingResizeContext | null = null;
    private floatingTabCtx: FloatingTabDragContext | null = null;

    private dockingPreview: DockingPreview | null = null;
    private dividePreview: HTMLElement | null = null;
    private highlightedHeader: HTMLElement | null = null;
    private tabInsertPreview: HTMLElement | null = null;
    private tabReorderTarget: { containerId: string; index: number } | null = null;

    public constructor(private readonly host: InteractionHost) {
        this.store = host.store;
        this.workspaceElement = host.workspaceElement;
    }

    public handleMouseDown(target: HTMLElement, event: InputEvent): DragSession | null {
        return (
            this.tryBeginFloatingTabDrag(target, event) ??
            this.tryBeginFloatingResize(target, event) ??
            this.tryBeginFloatingTabbarDrag(target, event) ??
            this.tryBeginFloatingHeaderDrag(target, event)
        );
    }

    public cancel(): void {
        this.floatingDragCtx = null;
        this.floatingResizeCtx = null;
        this.floatingTabCtx = null;
        this.clearDockingPreview();
        this.clearTabReorderState();
    }

    public beginFloatingDragFromTab(nodeId: string, event: MouseEvent): void {
        const rootId = this.store.getFloatingRootIdByNode(nodeId);
        if (!rootId) {
            requestAnimationFrame(() => this.beginFloatingDragFromTab(nodeId, event));
            return;
        }

        const floatingElement = this.findFloatingElement(rootId);
        if (!floatingElement) {
            requestAnimationFrame(() => {
                const retryElement = this.findFloatingElement(rootId);
                if (!retryElement) {
                    this.host.endSession(true);
                    return;
                }
                this.startFloatingWindowDrag(rootId, retryElement, event);
            });
            return;
        }

        this.startFloatingWindowDrag(rootId, floatingElement, event);
    }

    private startFloatingWindowDrag(rootId: string, element: HTMLElement, mouseEvent: MouseEvent): void {
        const syntheticEvent = this.host.createSyntheticInputEvent(mouseEvent);
        const session = this.beginFloatingWindowDrag(rootId, element, syntheticEvent);
        if (session) {
            this.host.replaceSession(session);
        } else {
            this.host.endSession(true);
        }
    }

    private findFloatingElement(rootId: string): HTMLElement | null {
        return this.workspaceElement.querySelector<HTMLElement>(`.pale-window-floating[data-node-id="${rootId}"]`);
    }

    private setupFloatingDragContext(
        rootId: string,
        element: HTMLElement,
        event: InputEvent
    ): FloatingDragContext | null {
        const descriptor = this.store.getFloatingDescriptor(rootId);
        if (!descriptor) {
            return null;
        }

        const global = this.getPointer(event);
        this.clearDockingPreview();

        const context: FloatingDragContext = {
            descriptor: { ...descriptor },
            element,
            startPointer: global,
            startPosition: { x: descriptor.x, y: descriptor.y }
        };

        this.floatingDragCtx = context;
        element.classList.add('pale-window-floating--dragging');
        return context;
    }

    private beginFloatingWindowDrag(rootId: string, element: HTMLElement, event: InputEvent): DragSession | null {
        const context = this.setupFloatingDragContext(rootId, element, event);
        if (!context) {
            return null;
        }

        return {
            type: 'floating',
            onMove: (mouse: MouseEvent) => this.handleFloatingMove(mouse),
            onUp: (cancelled: boolean) => this.stopFloatingDrag(cancelled)
        };
    }

    private beginFloatingWindowRepositionDrag(
        rootId: string,
        element: HTMLElement,
        event: InputEvent
    ): DragSession | null {
        const context = this.setupFloatingDragContext(rootId, element, event);
        if (!context) {
            return null;
        }

        return {
            type: 'floating',
            onMove: (mouse: MouseEvent) => this.handleFloatingRepositionMove(mouse),
            onUp: (cancelled: boolean) => this.stopFloatingDrag(cancelled)
        };
    }

    private beginFloatingTabbarDragSession(rootId: string, event: InputEvent): DragSession | null {
        const liveElement = this.findFloatingElement(rootId);
        if (liveElement) {
            return this.beginFloatingWindowRepositionDrag(rootId, liveElement, event);
        }

        let lastMouseEvent: MouseEvent | null = null;
        const placeholderSession: DragSession = {
            type: 'floating',
            onMove: (mouse: MouseEvent) => {
                lastMouseEvent = mouse;
            },
            onUp: (cancelled: boolean) => {
                if (!cancelled) {
                    this.stopFloatingDrag(true);
                }
            }
        };

        requestAnimationFrame(() => {
            const retryElement = this.findFloatingElement(rootId);
            if (!retryElement) {
                this.stopFloatingDrag(true);
                this.host.endSession(true);
                return;
            }

            const replacement = this.beginFloatingWindowRepositionDrag(rootId, retryElement, event);
            if (!replacement) {
                this.stopFloatingDrag(true);
                this.host.endSession(true);
                return;
            }

            this.host.replaceSession(replacement);
            if (lastMouseEvent) {
                replacement.onMove(lastMouseEvent);
            }
        });

        return placeholderSession;
    }

    private applyFloatingDragTransform(event: MouseEvent): void {
        if (!this.floatingDragCtx) return;
        const { descriptor, element, startPointer, startPosition } = this.floatingDragCtx;
        const dx = event.clientX - startPointer.x;
        const dy = event.clientY - startPointer.y;
        descriptor.x = startPosition.x + dx;
        descriptor.y = startPosition.y + dy;
        element.style.transform = `translate(${descriptor.x}px, ${descriptor.y}px)`;
    }

    private handleFloatingMove(event: MouseEvent): void {
        this.applyFloatingDragTransform(event);
        this.updateFloatingDockingPreview(event);
    }

    private handleFloatingRepositionMove(event: MouseEvent): void {
        this.applyFloatingDragTransform(event);
        this.clearDockingPreview();
    }

    private stopFloatingDrag(cancelled: boolean): void {
        if (!this.floatingDragCtx) return;
        const { descriptor, element } = this.floatingDragCtx;
        element.classList.remove('pale-window-floating--dragging');

        const stillFloating = this.store.getFloatingContent(descriptor.rootId) !== null;
        if (!cancelled && stillFloating) {
            const liveDescriptor = this.store.getFloatingDescriptor(descriptor.rootId);
            this.store.setFloatingWindow({
                ...descriptor,
                activeNodeId: liveDescriptor?.activeNodeId ?? descriptor.activeNodeId
            });
        }
        if (stillFloating) {
            this.store.bringFloatingToFront(descriptor.rootId);
        }

        if (!cancelled) {
            this.commitDocking();
        } else {
            this.clearDockingPreview();
        }
        this.floatingDragCtx = null;
    }

    private beginFloatingResize(rootId: string, handle: string, event: InputEvent): DragSession | null {
        const descriptor = this.store.getFloatingDescriptor(rootId);
        if (!descriptor) return null;

        const liveElement = this.findFloatingElement(rootId);
        if (!liveElement) {
            return null;
        }

        const pointer = this.getPointer(event);

        this.floatingResizeCtx = {
            descriptor: { ...descriptor },
            element: liveElement,
            handle,
            startPointer: pointer,
            startBounds: {
                x: descriptor.x,
                y: descriptor.y,
                width: descriptor.width,
                height: descriptor.height
            },
            workspaceRect: this.workspaceElement.getBoundingClientRect()
        };
        liveElement.classList.add('pale-window-floating--resizing');

        return {
            type: 'floating-resize',
            onMove: (mouse: MouseEvent) => this.handleFloatingResizeMove(mouse),
            onUp: (cancelled: boolean) => this.stopFloatingResize(cancelled)
        };
    }

    private tryBeginFloatingTabDrag(target: HTMLElement, event: InputEvent): DragSession | null {
        const floatingTab = target.closest<HTMLElement>('.pale-window-floating .pale-window-tab');
        if (!floatingTab || !floatingTab.dataset.tabId) {
            return null;
        }
        return this.beginFloatingTabDrag(floatingTab, event);
    }

    private tryBeginFloatingResize(target: HTMLElement, event: InputEvent): DragSession | null {
        const resizeHandle = target.closest<HTMLElement>('[data-floating-handle]');
        if (!resizeHandle) {
            return null;
        }
        const floatingElement = resizeHandle.closest<HTMLElement>('.pale-window-floating');
        const handle = resizeHandle.dataset.floatingHandle ?? '';
        if (!floatingElement || !floatingElement.dataset.nodeId || !handle) {
            return null;
        }
        return this.beginFloatingResize(floatingElement.dataset.nodeId, handle, event);
    }

    private tryBeginFloatingTabbarDrag(target: HTMLElement, event: InputEvent): DragSession | null {
        const floatingTabbar = target.closest<HTMLElement>('.pale-window-floating .pale-window-tabbar');
        if (!floatingTabbar) {
            return null;
        }
        if (target.closest('.pale-window-tab')) {
            return null;
        }
        const floatingElement = floatingTabbar.closest<HTMLElement>('.pale-window-floating');
        const rootId = floatingElement?.dataset.nodeId;
        if (!rootId) {
            return null;
        }
        return this.beginFloatingTabbarDragSession(rootId, event);
    }

    private tryBeginFloatingHeaderDrag(target: HTMLElement, event: InputEvent): DragSession | null {
        const floatingHeader = target.closest<HTMLElement>('.pale-window-floating .pale-window-simple__header');
        if (!floatingHeader || !floatingHeader.dataset.nodeId) {
            return null;
        }
        const floatingElement = floatingHeader.closest<HTMLElement>('.pale-window-floating');
        const rootId =
            floatingElement?.dataset.nodeId ?? this.store.getFloatingRootIdByNode(floatingHeader.dataset.nodeId);
        if (!floatingElement || !rootId) {
            return null;
        }
        return this.beginFloatingWindowDrag(rootId, floatingElement, event);
    }

    private handleFloatingResizeMove(event: MouseEvent): void {
        if (!this.floatingResizeCtx) return;
        const { descriptor, element, handle, startPointer, startBounds, workspaceRect } = this.floatingResizeCtx;
        const dx = event.clientX - startPointer.x;
        const dy = event.clientY - startPointer.y;

        const minWidth = 200;
        const minHeight = 160;

        let { x, y, width, height } = startBounds;

        if (handle.includes('e')) {
            width = startBounds.width + dx;
        }
        if (handle.includes('s')) {
            height = startBounds.height + dy;
        }
        if (handle.includes('w')) {
            width = startBounds.width - dx;
            x = startBounds.x + dx;
        }
        if (handle.includes('n')) {
            height = startBounds.height - dy;
            y = startBounds.y + dy;
        }

        width = Math.max(minWidth, width);
        height = Math.max(minHeight, height);

        x = Math.max(0, Math.min(x, workspaceRect.width - minWidth));
        y = Math.max(0, Math.min(y, workspaceRect.height - minHeight));
        if (x + width > workspaceRect.width) {
            width = Math.max(minWidth, workspaceRect.width - x);
        }
        if (y + height > workspaceRect.height) {
            height = Math.max(minHeight, workspaceRect.height - y);
        }

        descriptor.x = x;
        descriptor.y = y;
        descriptor.width = width;
        descriptor.height = height;

        element.style.transform = `translate(${x}px, ${y}px)`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
    }

    private stopFloatingResize(cancelled: boolean): void {
        if (!this.floatingResizeCtx) return;
        const { descriptor, element } = this.floatingResizeCtx;
        element.classList.remove('pale-window-floating--resizing');
        if (!cancelled) {
            const liveDescriptor = this.store.getFloatingDescriptor(descriptor.rootId);
            this.store.setFloatingWindow({
                ...descriptor,
                activeNodeId: liveDescriptor?.activeNodeId ?? descriptor.activeNodeId
            });
        }
        this.floatingResizeCtx = null;
    }

    private beginFloatingTabDrag(tabElement: HTMLElement, event: InputEvent): DragSession | null {
        const nodeId = tabElement.dataset.tabId;
        if (!nodeId) return null;
        const tabBar = tabElement.parentElement as HTMLElement | null;
        if (!tabBar) return null;

        const containerElement = tabBar.closest<HTMLElement>('.pale-window-tabContainer');
        const containerId = containerElement?.dataset.nodeId;
        if (!containerId) return null;

        const containerNode = this.store.getNode<TabContainerNode>(containerId);
        if (!containerNode || containerNode.type !== 'tab') return null;

        if (containerNode.activeChildId !== nodeId) {
            this.store.activate(nodeId);
        }

        const resolvedContainer =
            this.workspaceElement.querySelector<HTMLElement>(`.pale-window-tabContainer[data-node-id="${containerId}"]`) ??
            containerElement;
        const nodeElement =
            resolvedContainer?.querySelector<HTMLElement>(`.pale-window-simple[data-node-id="${nodeId}"]`);
        if (!nodeElement) return null;

        const windowRect = nodeElement.getBoundingClientRect();
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const pointer = this.getPointer(event, windowRect);

        this.floatingTabCtx = {
            nodeId,
            containerId,
            tabBar,
            tabBarRect: tabBar.getBoundingClientRect(),
            pointerOffset: pointer.pointerOffset,
            windowRect,
            workspaceRect,
            detached: false
        };
        this.tabReorderTarget = null;
        this.hideTabInsertPreview();

        return {
            type: 'floating-tab',
            onMove: (mouse: MouseEvent) => this.handleFloatingTabMove(mouse),
            onUp: (cancelled: boolean) => this.stopFloatingTabDrag(cancelled)
        };
    }

    private handleFloatingTabMove(event: MouseEvent): void {
        if (!this.floatingTabCtx || this.floatingTabCtx.detached) {
            return;
        }

        if (this.updateFloatingTabReorder(event)) {
            return;
        }

        const rect = this.floatingTabCtx.tabBarRect;
        const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;

        if (outside) {
            this.clearTabReorderState();
            this.detachFloatingTab(event);
        }
    }

    private stopFloatingTabDrag(cancelled: boolean): void {
        if (!this.floatingTabCtx) {
            return;
        }

        if (!cancelled && !this.floatingTabCtx.detached) {
            this.commitFloatingTabReorder();
        }

        this.clearTabReorderState();
        this.floatingTabCtx = null;
    }

    private commitFloatingTabReorder(): void {
        if (!this.floatingTabCtx || !this.tabReorderTarget) {
            return;
        }
        const { nodeId, containerId } = this.floatingTabCtx;
        this.store.moveSimpleToTab(nodeId, containerId, this.tabReorderTarget.index, {
            activate: true,
            scope: 'floating'
        });
    }

    private detachFloatingTab(event: MouseEvent): void {
        if (!this.floatingTabCtx) {
            return;
        }
        const { nodeId, pointerOffset, windowRect, workspaceRect } = this.floatingTabCtx;
        const width = windowRect.width;
        const height = windowRect.height;
        let x = event.clientX - workspaceRect.left - pointerOffset.x;
        let y = event.clientY - workspaceRect.top - pointerOffset.y;
        x = Math.max(0, Math.min(x, workspaceRect.width - width));
        y = Math.max(0, Math.min(y, workspaceRect.height - height));

        this.store.detachSimpleWindow({
            nodeId,
            x,
            y,
            width,
            height,
            snapped: false
        });

        this.floatingTabCtx.detached = true;
        this.floatingTabCtx = null;
        this.host.beginFloatingDragFromTab(nodeId, event);
    }

    private updateFloatingTabReorder(event: MouseEvent): boolean {
        if (!this.floatingTabCtx) {
            return false;
        }
        const tabBar = this.floatingTabCtx.tabBar;
        const rect = this.floatingTabCtx.tabBarRect;
        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top - TAB_REORDER_VERTICAL_MARGIN &&
            event.clientY <= rect.bottom + TAB_REORDER_VERTICAL_MARGIN;

        if (!inside) {
            this.clearTabReorderState();
            return false;
        }

        const { index, left } = this.computeTabInsertPosition(tabBar, event, this.floatingTabCtx.nodeId);
        this.showTabInsertPreview(tabBar, left);
        this.tabReorderTarget = { containerId: this.floatingTabCtx.containerId, index };

        this.store.moveSimpleToTab(this.floatingTabCtx.nodeId, this.floatingTabCtx.containerId, index, {
            activate: true,
            scope: 'floating'
        });

        this.refreshFloatingTabReferences();
        return true;
    }

    private refreshFloatingTabReferences(): void {
        if (!this.floatingTabCtx) {
            return;
        }
        const containerEl = this.workspaceElement.querySelector<HTMLElement>(
            `.pale-window-tabContainer[data-node-id="${this.floatingTabCtx.containerId}"]`
        );
        if (!containerEl) {
            return;
        }
        const tabBar = containerEl.querySelector<HTMLElement>('.pale-window-tabbar');
        if (!tabBar) {
            return;
        }
        this.floatingTabCtx.tabBar = tabBar;
        this.floatingTabCtx.tabBarRect = tabBar.getBoundingClientRect();
    }

    private clearTabReorderState(): void {
        this.tabReorderTarget = null;
        this.hideTabInsertPreview();
    }

    private ensureTabInsertPreview(): HTMLElement {
        if (!this.tabInsertPreview) {
            this.tabInsertPreview = document.createElement('div');
            this.tabInsertPreview.className = 'pale-window-tab-insert-preview';
            this.tabInsertPreview.style.display = 'none';
        }
        return this.tabInsertPreview;
    }

    private showTabInsertPreview(tabbar: HTMLElement, left: number): void {
        const preview = this.ensureTabInsertPreview();
        if (preview.parentElement !== tabbar) {
            tabbar.appendChild(preview);
        }
        preview.style.display = 'block';
        preview.style.left = `${Math.round(left)}px`;
    }

    private hideTabInsertPreview(): void {
        if (this.tabInsertPreview) {
            this.tabInsertPreview.style.display = 'none';
        }
    }

    private computeTabInsertPosition(
        tabbar: HTMLElement,
        event: MouseEvent,
        excludeTabId?: string
    ): { index: number; left: number } {
        const tabbarRect = tabbar.getBoundingClientRect();
        const tabs = Array.from(tabbar.querySelectorAll<HTMLElement>('.pale-window-tab')).filter(tab =>
            excludeTabId ? tab.dataset.tabId !== excludeTabId : true
        );
        const pointerX = event.clientX;
        let index = tabs.length;

        for (let i = 0; i < tabs.length; i += 1) {
            const tab = tabs[i];
            const rect = tab.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;
            if (pointerX < midpoint) {
                index = i;
                break;
            }
        }

        let left: number;
        if (tabs.length === 0) {
            left = tabbarRect.width / 2;
        } else if (index >= tabs.length) {
            const rect = tabs[tabs.length - 1].getBoundingClientRect();
            left = rect.right - tabbarRect.left + 4;
        } else {
            const rect = tabs[index].getBoundingClientRect();
            left = rect.left - tabbarRect.left - 2;
        }

        left = Math.max(4, Math.min(left, tabbarRect.width - 4));
        return { index, left };
    }

    private updateFloatingDockingPreview(event: MouseEvent): void {
        if (!this.floatingDragCtx) {
            return;
        }
        const target = this.pickDockingTarget(event, this.floatingDragCtx.element);
        const liveDescriptor = this.store.getFloatingDescriptor(this.floatingDragCtx.descriptor.rootId);
        const activeNodeId = liveDescriptor?.activeNodeId ?? this.floatingDragCtx.descriptor.activeNodeId ?? '';
        const preview = target ? this.resolveDockingPreview(target, event, activeNodeId) : null;
        this.applyDockingPreview(preview);
    }

    private pickDockingTarget(event: MouseEvent, floatingElement: HTMLElement): HTMLElement | null {
        const previous = floatingElement.style.pointerEvents;
        floatingElement.style.pointerEvents = 'none';
        const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
        floatingElement.style.pointerEvents = previous;
        return target;
    }

    private resolveDockingPreview(
        element: HTMLElement,
        event: MouseEvent,
        sourceId: string
    ): DockingPreview | null {
        const tabbar = element.closest<HTMLElement>('.pale-window-tabbar');
        if (tabbar) {
            const scope = this.resolveDockingScope(tabbar);
            const container = tabbar.closest<HTMLElement>('.pale-window-tabContainer');
            const containerId = container?.dataset.nodeId;
            if (!containerId) {
                return null;
            }
            const containerNode = this.store.getNode<TabContainerNode>(containerId);
            if (!containerNode || containerNode.type !== 'tab') {
                return null;
            }
            const { index, left } = this.computeTabInsertPosition(tabbar, event);
            return { kind: 'tab', scope, containerId, index, tabbar, left };
        }

        const header = element.closest<HTMLElement>('.pale-window-simple__header');
        if (header && header.dataset.nodeId && header.dataset.nodeId !== sourceId) {
            const scope = this.resolveDockingScope(header);
            const position = this.resolveHeaderPosition(header, event);
            return {
                kind: 'simple',
                scope,
                targetSimpleId: header.dataset.nodeId,
                position,
                header
            };
        }

        const content = element.closest<HTMLElement>('.pale-window-tabcontainer__content');
        if (content) {
            const scope = this.resolveDockingScope(content);
            const container = content.closest<HTMLElement>('.pale-window-tabContainer');
            const containerId = container?.dataset.nodeId;
            if (!containerId) {
                return null;
            }
            const containerNode = this.store.getNode<TabContainerNode>(containerId);
            if (!containerNode || containerNode.type !== 'tab') {
                return null;
            }

            const rect = content.getBoundingClientRect();
            if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
            ) {
                return null;
            }

            // Check if within leaf container edge 20% zone
            if (this.isWithinDivideFloatZone(rect, event.clientX, event.clientY)) {
                const side = this.calculateNearestSide(rect, event.clientX, event.clientY);
                const divide = this.mapSideToDivide(side);
                if (!divide) {
                    return null; // Top edge does not trigger split
                }
                return {
                    kind: 'divide',
                    scope,
                    targetId: containerId,
                    targetType: 'tab',
                    direction: divide.direction,
                    position: divide.position,
                    side,
                    host: content
                };
            }

            // Check if within parent container edge 10% zone for node promotion
            const parentContainer = container.parentElement?.closest<HTMLElement>('.pale-window-split');
            if (parentContainer) {
                const parentRect = parentContainer.getBoundingClientRect();
                if (this.isWithinParentContainerEdge(parentRect, event.clientX, event.clientY)) {
                    const parentId = parentContainer.dataset.nodeId;
                    if (parentId) {
                        const parentNode = this.store.getNode(parentId);
                        if (parentNode && parentNode.type === 'split') {
                            const side = this.calculateNearestSide(parentRect, event.clientX, event.clientY);
                            const divide = this.mapSideToDivide(side);
                            if (!divide) {
                                return null; // Top edge does not trigger
                            }
                            // Node promotion: add to parent container
                            return {
                                kind: 'divide',
                                scope,
                                targetId: parentId,
                                targetType: 'split',
                                direction: divide.direction,
                                position: divide.position,
                                side,
                                host: parentContainer
                            };
                        }
                    }
                }
            }

            return null;
        }

        const simple = element.closest<HTMLElement>('.pale-window-simple');
        if (simple && simple.dataset.nodeId && simple.dataset.nodeId !== sourceId) {
            const scope = this.resolveDockingScope(simple);
            const rect = simple.getBoundingClientRect();
            if (
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom
            ) {
                return null;
            }

            // Check if within leaf container edge 20% zone
            if (this.isWithinDivideFloatZone(rect, event.clientX, event.clientY)) {
                const side = this.calculateNearestSide(rect, event.clientX, event.clientY);
                const divide = this.mapSideToDivide(side);
                if (!divide) {
                    return null; // Top edge does not trigger split
                }
                return {
                    kind: 'divide',
                    scope,
                    targetId: simple.dataset.nodeId,
                    targetType: 'simple',
                    direction: divide.direction,
                    position: divide.position,
                    side,
                    host: simple
                };
            }

            // Check if within parent container edge 10% zone for node promotion
            const parentContainer = simple.parentElement?.closest<HTMLElement>('.pale-window-split');
            if (parentContainer) {
                const parentRect = parentContainer.getBoundingClientRect();
                if (this.isWithinParentContainerEdge(parentRect, event.clientX, event.clientY)) {
                    const parentId = parentContainer.dataset.nodeId;
                    if (parentId) {
                        const parentNode = this.store.getNode(parentId);
                        if (parentNode && parentNode.type === 'split') {
                            const side = this.calculateNearestSide(parentRect, event.clientX, event.clientY);
                            const divide = this.mapSideToDivide(side);
                            if (!divide) {
                                return null; // Top edge does not trigger
                            }
                            // Node promotion: add to parent container
                            return {
                                kind: 'divide',
                                scope,
                                targetId: parentId,
                                targetType: 'split',
                                direction: divide.direction,
                                position: divide.position,
                                side,
                                host: parentContainer
                            };
                        }
                    }
                }
            }

            return null;
        }

        // Check if workspace is empty and mouse is over workspace area
        if (this.store.getRootId() === null) {
            const workspaceRect = this.workspaceElement.getBoundingClientRect();
            // Check if mouse is within workspace bounds (excluding floating windows)
            if (
                event.clientX >= workspaceRect.left &&
                event.clientX <= workspaceRect.right &&
                event.clientY >= workspaceRect.top &&
                event.clientY <= workspaceRect.bottom
            ) {
                // Check if mouse is not over a floating window
                const floatingWindow = element.closest<HTMLElement>('.pale-window-floating');
                if (!floatingWindow || floatingWindow.dataset.nodeId === sourceId) {
                    // Find root layer or placeholder for preview host
                    const rootLayer = this.workspaceElement.querySelector<HTMLElement>('.pale-window-root-layer');
                    const placeholder = this.workspaceElement.querySelector<HTMLElement>('.pale-window-placeholder');
                    return {
                        kind: 'workspace',
                        scope: 'docking',
                        host: rootLayer || placeholder || this.workspaceElement
                    };
                }
            }
        }

        return null;
    }

    private resolveDockingScope(element: HTMLElement | null): DockingScope {
        if (!element) {
            return 'docking';
        }
        return element.closest('.pale-window-floating') ? 'floating' : 'docking';
    }

    private applyDockingPreview(preview: DockingPreview | null): void {
        if (!preview) {
            if (this.dockingPreview) {
                this.clearDockingPreview();
            }
            return;
        }

        this.dockingPreview = preview;

        switch (preview.kind) {
            case 'workspace':
                this.clearHeaderHighlight();
                this.hideTabInsertPreview();
                if (preview.host) {
                    this.showWorkspacePreview(preview.host);
                }
                break;
            case 'tab':
                this.clearHeaderHighlight();
                this.hideDividePreview();
                if (preview.tabbar && typeof preview.left === 'number') {
                    this.showTabInsertPreview(preview.tabbar, preview.left);
                }
                break;
            case 'simple':
                this.hideDividePreview();
                this.hideTabInsertPreview();
                if (preview.header) {
                    this.highlightHeader(preview.header);
                }
                break;
            case 'divide':
                this.clearHeaderHighlight();
                this.hideTabInsertPreview();
                if (preview.host && preview.side) {
                    this.showDividePreview(preview.host, preview.side);
                }
                break;
            default:
                break;
        }
    }

    private clearDockingPreview(): void {
        this.hideDividePreview();
        this.clearHeaderHighlight();
        this.hideTabInsertPreview();
        this.dockingPreview = null;
    }

    private highlightHeader(header: HTMLElement): void {
        if (this.highlightedHeader === header) {
            return;
        }
        this.clearHeaderHighlight();
        this.highlightedHeader = header;
        header.classList.add('pale-window-simple__header--dragover');
    }

    private clearHeaderHighlight(): void {
        if (this.highlightedHeader) {
            this.highlightedHeader.classList.remove('pale-window-simple__header--dragover');
            this.highlightedHeader = null;
        }
    }

    private ensureDividePreview(): HTMLElement {
        if (!this.dividePreview) {
            this.dividePreview = document.createElement('div');
            this.dividePreview.className = 'pale-window-divide-preview';
            this.dividePreview.style.display = 'none';
            this.workspaceElement.appendChild(this.dividePreview);
        }
        return this.dividePreview;
    }

    private showDividePreview(host: HTMLElement, side: DockSide): void {
        const preview = this.ensureDividePreview();
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const rect = host.getBoundingClientRect();

        let left = rect.left;
        let top = rect.top;
        let width = rect.width;
        let height = rect.height;

        if (side === 'top' || side === 'bottom') {
            height = rect.height / 2;
            if (side === 'bottom') {
                top = rect.bottom - height;
            }
        } else {
            width = rect.width / 2;
            if (side === 'right') {
                left = rect.right - width;
            }
        }

        preview.style.display = 'block';
        preview.style.left = `${left - workspaceRect.left}px`;
        preview.style.top = `${top - workspaceRect.top}px`;
        preview.style.width = `${width}px`;
        preview.style.height = `${height}px`;
    }

    private hideDividePreview(): void {
        if (this.dividePreview) {
            this.dividePreview.style.display = 'none';
        }
    }

    private showWorkspacePreview(host: HTMLElement): void {
        const preview = this.ensureDividePreview();
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const rect = host.getBoundingClientRect();

        // Show preview covering the entire workspace area
        preview.style.display = 'block';
        preview.style.left = `${rect.left - workspaceRect.left}px`;
        preview.style.top = `${rect.top - workspaceRect.top}px`;
        preview.style.width = `${rect.width}px`;
        preview.style.height = `${rect.height}px`;
    }

    private commitDocking(): boolean {
        if (!this.floatingDragCtx || !this.dockingPreview) {
            this.clearDockingPreview();
            return false;
        }

        const descriptor = this.floatingDragCtx.descriptor;
        const liveDescriptor = this.store.getFloatingDescriptor(descriptor.rootId);
        const sourceNodeId = liveDescriptor?.activeNodeId ?? descriptor.activeNodeId ?? '';
        const preview = this.dockingPreview;
        const scope = preview.scope;

        if (!sourceNodeId) {
            this.clearDockingPreview();
            return false;
        }

        switch (preview.kind) {
            case 'workspace': {
                // Convert floating window to docking root
                const rootId = descriptor.rootId;
                this.store.setFloatingAsRoot(rootId);
                break;
            }
            case 'tab':
                if (!preview.containerId || typeof preview.index !== 'number') break;
                this.store.moveSimpleToTab(sourceNodeId, preview.containerId, preview.index, {
                    activate: true,
                    scope
                });
                break;
            case 'simple':
                if (!preview.targetSimpleId || !preview.position) break;
                this.store.stackSimpleIntoSimple(preview.targetSimpleId, sourceNodeId, {
                    position: preview.position,
                    activate: true,
                    scope
                });
                break;
            case 'divide': {
                if (!preview.targetId || !preview.direction || !preview.position) break;
                let targetSimpleId: string | null = null;
                if (preview.targetType === 'tab') {
                    targetSimpleId = this.resolveActiveSimpleIdFromContainer(preview.targetId);
                } else if (preview.targetType === 'split') {
                    // For split container, find a simple node within it to use as target
                    // The node promotion logic will handle adding to parent
                    const splitNode = this.store.getNode(preview.targetId);
                    if (splitNode && splitNode.type === 'split') {
                        // Find first simple node in the split container
                        targetSimpleId = this.resolveActiveSimpleIdFromContainer(preview.targetId);
                    }
                } else {
                    targetSimpleId = preview.targetId;
                }
                if (!targetSimpleId) break;
                this.store.divideSimpleWithExisting(targetSimpleId, sourceNodeId, preview.direction, preview.position, {
                    scope
                });
                break;
            }
            default:
                break;
        }

        this.clearDockingPreview();
        return true;
    }

    private resolveActiveSimpleIdFromContainer(containerId: string): string | null {
        const container = this.store.getNode<TabContainerNode>(containerId);
        if (!container || container.type !== 'tab') {
            return null;
        }
        const active = this.store.getNode(container.activeChildId);
        if (active && active.type === 'simple') {
            return active.id;
        }
        for (const childId of container.children) {
            const child = this.store.getNode(childId);
            if (child && child.type === 'simple') {
                return child.id;
            }
        }
        return null;
    }

    private resolveHeaderPosition(header: HTMLElement, event: MouseEvent): PositionHint {
        const rect = header.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        return event.clientX < midpoint ? 'before' : 'after';
    }

    private isWithinDivideFloatZone(rect: DOMRect, x: number, y: number): boolean {
        // 20% edge zone for leaf container split
        const edgeZoneRatio = 0.2;
        const edgeWidth = rect.width * edgeZoneRatio;
        const edgeHeight = rect.height * edgeZoneRatio;
        
        // Check if within edge zones (left, right, bottom - not top)
        const inLeftEdge = x >= rect.left && x <= rect.left + edgeWidth;
        const inRightEdge = x >= rect.right - edgeWidth && x <= rect.right;
        const inBottomEdge = y >= rect.bottom - edgeHeight && y <= rect.bottom;
        
        return inLeftEdge || inRightEdge || inBottomEdge;
    }
    
    private isWithinParentContainerEdge(rect: DOMRect, x: number, y: number): boolean {
        // 10% edge zone for parent container promotion
        const edgeZoneRatio = 0.1;
        const edgeWidth = rect.width * edgeZoneRatio;
        const edgeHeight = rect.height * edgeZoneRatio;
        
        // Check if within edge zones (left, right, bottom - not top)
        const inLeftEdge = x >= rect.left && x <= rect.left + edgeWidth;
        const inRightEdge = x >= rect.right - edgeWidth && x <= rect.right;
        const inBottomEdge = y >= rect.bottom - edgeHeight && y <= rect.bottom;
        
        return inLeftEdge || inRightEdge || inBottomEdge;
    }

    private calculateNearestSide(rect: DOMRect, x: number, y: number): DockSide {
        const width = rect.width !== 0 ? rect.width : 1;
        const height = rect.height !== 0 ? rect.height : 1;

        const distances: Record<DockSide, number> = {
            top: Math.abs(y - rect.top) / height,
            bottom: Math.abs(rect.bottom - y) / height,
            left: Math.abs(x - rect.left) / width,
            right: Math.abs(rect.right - x) / width
        };

        let side: DockSide = 'top';
        let min = distances.top;
        (['bottom', 'left', 'right'] as DockSide[]).forEach(candidate => {
            if (distances[candidate] < min) {
                min = distances[candidate];
                side = candidate;
            }
        });
        return side;
    }

    private mapSideToDivide(side: DockSide): { direction: SplitDirection; position: PositionHint } | null {
        switch (side) {
            case 'left':
                return { direction: 'horizontal', position: 'before' };
            case 'right':
                return { direction: 'horizontal', position: 'after' };
            case 'bottom':
                return { direction: 'vertical', position: 'after' };
            case 'top':
            default:
                return null; // Top edge does not trigger split
        }
    }

    private getPointer(event: InputEvent, windowRect?: DOMRect): { x: number; y: number; pointerOffset: { x: number; y: number } } {
        const anyEvent = event as any;
        const global = anyEvent?.globalPosition
            ? anyEvent.globalPosition
            : { x: anyEvent?.clientX ?? 0, y: anyEvent?.clientY ?? 0 };

        const pointerOffset = windowRect
            ? {
                  x: global.x - windowRect.left,
                  y: global.y - windowRect.top
              }
            : { x: 0, y: 0 };

        return { x: global.x, y: global.y, pointerOffset };
    }
}

