import { DragSession, InteractionHost, PointerState } from './window-interaction-shared';
import { WindowTreeStore } from '../window-tree-store';
import { TabContainerNode } from '../types';
import { InputEvent } from '../../../engine';

const TAB_REORDER_VERTICAL_MARGIN = 14;

interface DividerDragContext {
    nodeId: string;
    container: HTMLElement;
    firstPane: HTMLElement;
    secondPane: HTMLElement;
    divider: HTMLElement;
    dividerIndex: number;
    containerRect: DOMRect;
    previewRatio: number;
}

interface DockingTabDragContext extends PointerState {
    nodeId: string;
    containerId: string;
    tabBar: HTMLElement;
    tabBarRect: DOMRect;
    floated: boolean;
}

interface DockingLeafDragContext extends PointerState {
    nodeId: string;
    floated: boolean;
}

export class DockingInteraction {
    private readonly store: WindowTreeStore;
    private readonly workspaceElement: HTMLElement;

    private dividerCtx: DividerDragContext | null = null;
    private tabCtx: DockingTabDragContext | null = null;
    private leafCtx: DockingLeafDragContext | null = null;

    private tabReorderTarget: { containerId: string; index: number } | null = null;
    private tabInsertPreview: HTMLElement | null = null;

    public constructor(private readonly host: InteractionHost) {
        this.store = host.store;
        this.workspaceElement = host.workspaceElement;
    }

    public handleMouseDown(target: HTMLElement, event: InputEvent): DragSession | null {
        const divider = target.closest<HTMLElement>('.pale-window-split__divider');
        if (divider && divider.dataset.splitId && !divider.closest('.pale-window-floating')) {
            return this.beginDividerDrag(divider);
        }

        const tabElement = target.closest<HTMLElement>('.pale-window-tab');
        if (tabElement && tabElement.dataset.tabId && !tabElement.closest('.pale-window-floating')) {
            return this.beginDockingTabDrag(tabElement, event);
        }

        const header = target.closest<HTMLElement>('.pale-window-simple__header');
        if (header && header.dataset.nodeId && !header.closest('.pale-window-floating')) {
            return this.beginLeafDrag(header, event);
        }

        return null;
    }

    public cancel(): void {
        this.dividerCtx = null;
        this.tabCtx = null;
        this.leafCtx = null;
        this.clearTabReorderState();
    }

    private beginDividerDrag(divider: HTMLElement): DragSession | null {
        const splitId = divider.dataset.splitId;
        const dividerIndexStr = divider.dataset.dividerIndex;
        if (!splitId || dividerIndexStr === undefined) {
            return null;
        }
        const dividerIndex = parseInt(dividerIndexStr, 10);
        if (isNaN(dividerIndex)) {
            return null;
        }
        const node = this.store.getNode(splitId);
        if (!node || node.type !== 'split') {
            return null;
        }
        const container = divider.parentElement as HTMLElement | null;
        if (!container) {
            return null;
        }
        const firstPane = divider.previousElementSibling as HTMLElement | null;
        const secondPane = divider.nextElementSibling as HTMLElement | null;
        if (!firstPane || !secondPane) {
            return null;
        }

        const splitNode = node as import('../types').SplitContainerNode;
        const currentRatio = splitNode.ratios[dividerIndex] ?? 0.5;

        this.dividerCtx = {
            nodeId: node.id,
            container,
            firstPane,
            secondPane,
            divider,
            dividerIndex,
            containerRect: container.getBoundingClientRect(),
            previewRatio: currentRatio
        };

        return {
            type: 'divider',
            onMove: (event: MouseEvent) => this.handleDividerMove(event),
            onUp: (cancelled: boolean) => this.stopDividerDrag(cancelled)
        };
    }

    private handleDividerMove(event: MouseEvent): void {
        if (!this.dividerCtx) return;
        const { nodeId, container, containerRect, dividerIndex } = this.dividerCtx;
        const node = this.store.getNode(nodeId);
        if (!node || node.type !== 'split') {
            return;
        }

        const splitNode = node as import('../types').SplitContainerNode;
        let ratio: number;
        if (node.direction === 'horizontal') {
            const totalWidth = containerRect.width;
            if (totalWidth <= 0) return;
            ratio = (event.clientX - containerRect.left) / totalWidth;
        } else {
            const totalHeight = containerRect.height;
            if (totalHeight <= 0) return;
            ratio = (event.clientY - containerRect.top) / totalHeight;
        }
        
        // Clamp ratio based on adjacent dividers
        const minRatio = dividerIndex > 0 ? splitNode.ratios[dividerIndex - 1] + 0.1 : 0.1;
        const maxRatio = dividerIndex < splitNode.ratios.length - 1 
            ? splitNode.ratios[dividerIndex + 1] - 0.1 
            : 0.9;
        ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
        
        this.dividerCtx.previewRatio = ratio;
        
        // Update preview ratios array
        const previewRatios = [...splitNode.ratios];
        previewRatios[dividerIndex] = ratio;
        
        // Update all panes' flex values
        const panes = Array.from(container.querySelectorAll<HTMLElement>('.pale-window-split__pane'));
        for (let i = 0; i < panes.length; i++) {
            let paneRatio: number;
            if (i === 0) {
                paneRatio = previewRatios[0];
            } else if (i === panes.length - 1) {
                paneRatio = 1 - previewRatios[previewRatios.length - 1];
            } else {
                paneRatio = previewRatios[i] - previewRatios[i - 1];
            }
            const clamped = Math.max(0.1, Math.min(0.9, paneRatio));
            panes[i].style.flex = `${clamped} 1 0`;
        }
    }

    private stopDividerDrag(cancelled: boolean): void {
        if (!this.dividerCtx) return;
        const { divider, nodeId, dividerIndex, previewRatio } = this.dividerCtx;
        divider.classList.remove('pale-window-split__divider--active');
        if (!cancelled) {
            this.store.updateSplitRatio(nodeId, dividerIndex, previewRatio);
        }
        this.dividerCtx = null;
    }

    private beginDockingTabDrag(tabElement: HTMLElement, event: InputEvent): DragSession | null {
        const nodeId = tabElement.dataset.tabId;
        if (!nodeId) return null;
        const tabBar = tabElement.parentElement as HTMLElement | null;
        if (!tabBar) return null;

        const tabContainer = tabBar.closest<HTMLElement>('.pale-window-tabContainer');
        const containerId = tabContainer?.dataset.nodeId;
        if (!containerId) return null;

        const containerNode = this.store.getNode<TabContainerNode>(containerId);
        if (!containerNode || containerNode.type !== 'tab') {
            return null;
        }

        if (containerNode.activeChildId !== nodeId) {
            this.store.activate(nodeId);
        }

        const resolvedContainer =
            this.workspaceElement.querySelector<HTMLElement>(`.pale-window-tabContainer[data-node-id="${containerId}"]`) ??
            tabContainer;
        const nodeElement =
            resolvedContainer?.querySelector<HTMLElement>(`.pale-window-simple[data-node-id="${nodeId}"]`);
        if (!nodeElement) return null;

        const windowRect = nodeElement.getBoundingClientRect();
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const pointer = this.getPointer(event, windowRect);

        this.tabReorderTarget = null;
        this.hideTabInsertPreview();

        this.tabCtx = {
            nodeId,
            containerId,
            tabBar,
            tabBarRect: tabBar.getBoundingClientRect(),
            pointerOffset: pointer.pointerOffset,
            windowRect,
            workspaceRect,
            floated: false
        };

        return {
            type: 'tab',
            onMove: (mouseEvent: MouseEvent) => this.handleDockingTabMove(mouseEvent),
            onUp: (cancelled: boolean) => this.stopDockingTabDrag(cancelled)
        };
    }

    private handleDockingTabMove(event: MouseEvent): void {
        if (!this.tabCtx || this.tabCtx.floated) {
            return;
        }

        if (this.updateTabReorderPreview(event)) {
            return;
        }

        const rect = this.tabCtx.tabBarRect;
        const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;

        if (outside) {
            this.clearTabReorderState();
            this.detachDockingTab(event);
        }
    }

    private stopDockingTabDrag(cancelled: boolean): void {
        if (!this.tabCtx) {
            return;
        }

        if (!cancelled && !this.tabCtx.floated) {
            this.commitTabReorder();
        }

        this.clearTabReorderState();
        this.tabCtx = null;
    }

    private detachDockingTab(event: MouseEvent): void {
        if (!this.tabCtx) {
            return;
        }

        const { nodeId, pointerOffset, windowRect, workspaceRect } = this.tabCtx;
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

        this.tabCtx.floated = true;
        this.tabCtx = null;
        this.host.beginFloatingDragFromTab(nodeId, event);
    }

    private commitTabReorder(): void {
        if (!this.tabCtx || !this.tabReorderTarget) {
            return;
        }
        const container = this.store.getNode<TabContainerNode>(this.tabReorderTarget.containerId);
        if (!container || container.type !== 'tab') {
            return;
        }

        this.store.moveSimpleToTab(
            this.tabCtx.nodeId,
            container.id,
            this.tabReorderTarget.index,
            {
                activate: true,
                scope: 'docking'
            }
        );
    }

    private beginLeafDrag(header: HTMLElement, event: InputEvent): DragSession | null {
        const nodeId = header.dataset.nodeId;
        if (!nodeId) {
            return null;
        }
        const wrapper = header.closest<HTMLElement>('.pale-window-simple');
        if (!wrapper) {
            return null;
        }

        const windowRect = wrapper.getBoundingClientRect();
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const pointer = this.getPointer(event, windowRect);

        this.leafCtx = {
            nodeId,
            pointerOffset: pointer.pointerOffset,
            windowRect,
            workspaceRect,
            floated: false
        };

        return {
            type: 'leaf',
            onMove: (mouseEvent: MouseEvent) => this.handleLeafMove(mouseEvent),
            onUp: (cancelled: boolean) => this.stopLeafDrag(cancelled)
        };
    }

    private handleLeafMove(event: MouseEvent): void {
        if (!this.leafCtx || this.leafCtx.floated) {
            return;
        }
        const { workspaceRect, windowRect } = this.leafCtx;
        const outsideWorkspace =
            event.clientX < workspaceRect.left ||
            event.clientX > workspaceRect.right ||
            event.clientY < workspaceRect.top ||
            event.clientY > workspaceRect.bottom;
        const outsideWindow =
            event.clientX < windowRect.left ||
            event.clientX > windowRect.right ||
            event.clientY < windowRect.top ||
            event.clientY > windowRect.bottom;

        if (outsideWorkspace || outsideWindow) {
            this.detachDockingLeaf(event);
        }
    }

    private stopLeafDrag(cancelled: boolean): void {
        if (!this.leafCtx) {
            return;
        }
        if (cancelled && !this.leafCtx.floated) {
            // nothing to commit
        }
        this.leafCtx = null;
    }

    private detachDockingLeaf(event: MouseEvent): void {
        if (!this.leafCtx) {
            return;
        }
        const { nodeId, pointerOffset, windowRect, workspaceRect } = this.leafCtx;
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

        this.leafCtx.floated = true;
        this.leafCtx = null;
        this.host.beginFloatingDragFromTab(nodeId, event);
    }

    private updateTabReorderPreview(event: MouseEvent): boolean {
        if (!this.tabCtx) {
            return false;
        }
        const tabBar = this.tabCtx.tabBar;
        const rect = this.tabCtx.tabBarRect;
        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top - TAB_REORDER_VERTICAL_MARGIN &&
            event.clientY <= rect.bottom + TAB_REORDER_VERTICAL_MARGIN;

        if (!inside) {
            this.clearTabReorderState();
            return false;
        }

        const { index, left } = this.computeTabInsertPosition(tabBar, event, this.tabCtx.nodeId);
        this.showTabInsertPreview(tabBar, left);
        this.tabReorderTarget = { containerId: this.tabCtx.containerId, index };
        return true;
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

    private getPointer(event: InputEvent, windowRect: DOMRect): {
        pointerOffset: { x: number; y: number };
    } {
        const anyEvent = event as any;
        const global = anyEvent?.globalPosition
            ? anyEvent.globalPosition
            : { x: anyEvent?.clientX ?? 0, y: anyEvent?.clientY ?? 0 };
        return {
            pointerOffset: {
                x: global.x - windowRect.left,
                y: global.y - windowRect.top
            }
        };
    }
}

