import { BaseWindow } from './base-window';
import {
    SimpleWindowNode,
    SplitContainerNode,
    SplitDirection,
    TabContainerNode,
    WindowTreeEvent,
    WindowTreeNode,
    WindowTreeNodeType,
    FloatingWindowDescriptor
} from './types';

type TreeListener = (event: WindowTreeEvent) => void;

type PositionHint = 'before' | 'after';

type OperationScope = 'docking' | 'floating';

let nodeIdCounter = 0;
const nextNodeId = (prefix: WindowTreeNodeType): string => `pe-${prefix}-${++nodeIdCounter}`;

export class WindowTreeStore {
    private rootId: string | null = null;
    private readonly nodesMap: Map<string, WindowTreeNode> = new Map();
    private readonly listeners: Set<TreeListener> = new Set();
    private readonly titleDisposers: Map<string, () => void> = new Map();
    private readonly floatingRootsMap: Map<string, FloatingWindowDescriptor> = new Map();
    private readonly floatingNodeIndex: Map<string, string> = new Map();
    private floatingZCounter = 1000;

    public subscribe(listener: TreeListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getRootId(): string | null {
        return this.rootId;
    }

    public getNode<T extends WindowTreeNode = WindowTreeNode>(id: string): T | null {
        return (this.nodesMap.get(id) as T | undefined) ?? null;
    }

    public getNodes(): Map<string, WindowTreeNode> {
        return this.nodesMap;
    }

    private requireNode<T extends WindowTreeNode>(id: string, type: WindowTreeNodeType): T {
        const node = this.nodesMap.get(id);
        if (!node || node.type !== type) {
            throw new Error(`Node "${id}" is not of expected type "${type}".`);
        }
        return node as T;
    }

    public initialize(window: BaseWindow, options?: { headless?: boolean }): SimpleWindowNode {
        this.reset();
        const node = this.createSimpleNode(window, options);
        this.nodesMap.set(node.id, node);
        const tabRoot = this.wrapInStandaloneTab(node);
        this.rootId = tabRoot.id;
        this.nodesMap.set(tabRoot.id, tabRoot);
        this.emit({ type: 'tree-changed' });
        return node;
    }

    public divideSimpleNode(
        targetId: string,
        direction: SplitDirection,
        window: BaseWindow,
        position: PositionHint = 'after',
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        const target = this.requireNode<SimpleWindowNode>(targetId, 'simple');
        const newNode = this.createSimpleNode(window, options);
        this.nodesMap.set(newNode.id, newNode);

        const parent = this.getParentContainerById(target.parentId);

        if (parent && parent.type === 'tab') {
            // Divide the entire tab container instead of the single tab.
            return this.divideTabContainer(parent, direction, newNode, target, position, 'docking');
        }

        // Check for node promotion: if parent is split with same direction, add to parent
        if (parent && parent.type === 'split' && parent.direction === direction) {
            const splitParent = parent as SplitContainerNode;
            const targetIndex = splitParent.children.indexOf(target.id);
            if (targetIndex !== -1) {
                newNode.parentId = splitParent.id;
                newNode.headless = true;
                
                if (position === 'before') {
                    splitParent.children.splice(targetIndex, 0, newNode.id);
                } else {
                    splitParent.children.splice(targetIndex + 1, 0, newNode.id);
                }
                
                // Recalculate ratios for equal distribution
                this.recalculateSplitRatios(splitParent);
                
                this.emit({ type: 'tree-changed' });
                return newNode;
            }
        }

        // Create new split container
        const splitContainer = this.createSplitContainerNode(direction);
        splitContainer.parentId = parent ? parent.id : null;

        if (position === 'before') {
            splitContainer.children = [newNode.id, target.id];
        } else {
            splitContainer.children = [target.id, newNode.id];
        }
        splitContainer.ratios = [0.5];

        target.parentId = splitContainer.id;
        newNode.parentId = splitContainer.id;
        newNode.headless = true;
        this.nodesMap.set(splitContainer.id, splitContainer);

        if (!parent) {
            this.rootId = splitContainer.id;
        } else if (parent.type === 'split') {
            const splitParent = parent as SplitContainerNode;
            const targetIndex = splitParent.children.indexOf(target.id);
            if (targetIndex !== -1) {
                splitParent.children[targetIndex] = splitContainer.id;
                this.recalculateSplitRatios(splitParent);
            }
        } else {
            const tabParent = parent as TabContainerNode;
            tabParent.children = tabParent.children.map((childId: string) =>
                childId === target.id ? splitContainer.id : childId
            );
            tabParent.activeChildId = splitContainer.children[0];
        }

        this.emit({ type: 'tree-changed' });
        return newNode;
    }

    public moveSimpleToTab(
        nodeId: string,
        containerId: string,
        index?: number,
        options?: { activate?: boolean; scope?: OperationScope }
    ): void {
        const container = this.requireNode<TabContainerNode>(containerId, 'tab');
        const node = this.requireNode<SimpleWindowNode>(nodeId, 'simple');

        const desiredActivation = options?.activate ?? true;
        const scope: OperationScope = options?.scope ?? 'docking';

        if (scope === 'docking' && container.parentId === null && this.rootId !== container.id) {
            this.rootId = container.id;
        }

        const existingIndex = container.children.indexOf(node.id);
        const baseLength = existingIndex === -1 ? container.children.length : container.children.length - 1;
        const insertIndexRaw = index ?? container.children.length;
        const insertIndex = Math.max(0, Math.min(insertIndexRaw, Math.max(0, baseLength)));

        if (node.parentId === container.id) {
            if (existingIndex === -1) {
                return;
            }

            if (existingIndex === insertIndex) {
                if (desiredActivation && container.activeChildId !== node.id) {
                    container.activeChildId = node.id;
                    const floatingRootId = this.findFloatingRootId(container.id);
                    if (floatingRootId) {
                        this.syncFloatingActiveNode(floatingRootId);
                    }
                    this.emit({ type: 'active-changed', containerId: container.id, activeChildId: node.id });
                }
                return;
            }

            container.children.splice(existingIndex, 1);
            const boundedIndex = Math.max(0, Math.min(insertIndex, container.children.length));
            container.children.splice(boundedIndex, 0, node.id);

            if (desiredActivation) {
                container.activeChildId = node.id;
                const floatingRootId = this.findFloatingRootId(container.id);
                if (floatingRootId) {
                    this.syncFloatingActiveNode(floatingRootId);
                }
                this.emit({ type: 'active-changed', containerId: container.id, activeChildId: node.id });
            }

            this.emit({ type: 'tree-changed' });
            return;
        }

        this.removeFloatingWindow(node.id);
        this.detachSimpleNode(node);

        node.parentId = container.id;
        node.headless = true;

        const boundedIndex = Math.max(0, Math.min(insertIndex, container.children.length));
        container.children.splice(boundedIndex, 0, node.id);

        if (desiredActivation) {
            container.activeChildId = node.id;
            const floatingRootId = this.findFloatingRootId(container.id);
            if (floatingRootId) {
                this.syncFloatingActiveNode(floatingRootId);
            }
        }

        this.emit({ type: 'tree-changed' });
        if (desiredActivation) {
            this.emit({ type: 'active-changed', containerId: container.id, activeChildId: node.id });
        }
    }

    public stackSimpleIntoSimple(
        targetId: string,
        sourceId: string,
        options?: { position?: PositionHint; activate?: boolean; scope?: OperationScope }
    ): void {
        if (targetId === sourceId) {
            return;
        }

        const target = this.requireNode<SimpleWindowNode>(targetId, 'simple');
        const position = options?.position ?? 'after';
        const activate = options?.activate ?? true;
        const scope: OperationScope = options?.scope ?? 'docking';
        const container = this.ensureTabContainer(target);

        let insertIndex = container.children.indexOf(target.id);
        if (insertIndex === -1) {
            insertIndex = container.children.length;
        }
        if (position === 'after') {
            insertIndex += 1;
        }

        this.moveSimpleToTab(sourceId, container.id, insertIndex, { activate, scope });
    }

    public divideSimpleWithExisting(
        targetId: string,
        sourceId: string,
        direction: SplitDirection,
        position: PositionHint = 'after',
        options?: { scope?: OperationScope }
    ): void {
        if (targetId === sourceId) {
            return;
        }

        const target = this.requireNode<SimpleWindowNode>(targetId, 'simple');
        const container = this.ensureTabContainer(target);
        const source = this.requireNode<SimpleWindowNode>(sourceId, 'simple');
        const scope: OperationScope = options?.scope ?? 'docking';

        this.removeFloatingWindow(source.id);
        this.detachSimpleNode(source);
        source.headless = true;

        this.divideTabContainer(container, direction, source, target, position, scope);
        this.emit({ type: 'active-changed', containerId: container.id, activeChildId: container.activeChildId });

        const sourceParentId = source.parentId;
        if (sourceParentId) {
            const parentTab = this.nodesMap.get(sourceParentId);
            if (parentTab && parentTab.type === 'tab') {
                this.emit({ type: 'active-changed', containerId: parentTab.id, activeChildId: parentTab.activeChildId });
            }
        }
    }

    public stackWithSimple(
        targetId: string,
        window: BaseWindow,
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        const target = this.requireNode<SimpleWindowNode>(targetId, 'simple');
        const newNode = this.createSimpleNode(window, options);
        this.nodesMap.set(newNode.id, newNode);

        const parent = this.getParentContainerById(target.parentId);

        if (parent && parent.type === 'tab') {
            parent.children.push(newNode.id);
            parent.activeChildId = newNode.id;
            newNode.parentId = parent.id;
            newNode.headless = true;
            this.emit({ type: 'tree-changed' });
            this.emit({ type: 'active-changed', containerId: parent.id, activeChildId: newNode.id });
            return newNode;
        }

        const tabNode = this.createTabNode();
        tabNode.children = [target.id, newNode.id];
        tabNode.activeChildId = newNode.id;
        tabNode.parentId = parent ? parent.id : null;

        target.parentId = tabNode.id;
        newNode.parentId = tabNode.id;
        target.headless = true;
        newNode.headless = true;
        this.nodesMap.set(tabNode.id, tabNode);

        if (!parent) {
            this.rootId = tabNode.id;
        } else if (parent.type === 'split') {
            const splitParent = parent as SplitContainerNode;
            const targetIndex = splitParent.children.indexOf(target.id);
            if (targetIndex !== -1) {
                splitParent.children[targetIndex] = tabNode.id;
                this.recalculateSplitRatios(splitParent);
            }
        } else {
            const tabParent = parent as TabContainerNode;
            tabParent.children = tabParent.children.map((childId: string) =>
                childId === target.id ? tabNode.id : childId
            );
            tabParent.activeChildId = tabNode.id;
        }

        this.emit({ type: 'tree-changed' });
        this.emit({ type: 'active-changed', containerId: tabNode.id, activeChildId: newNode.id });
        return newNode;
    }

    public activate(nodeId: string): void {
        const node = this.nodesMap.get(nodeId);
        if (!node) {
            return;
        }
        if (node.type === 'tab') {
            const firstChild = node.children[0] ?? null;
            if (!firstChild) {
                return;
            }
            node.activeChildId = firstChild;
            const floatingRootId = this.findFloatingRootId(node.id);
            if (floatingRootId) {
                this.syncFloatingActiveNode(floatingRootId);
            }
            this.emit({ type: 'active-changed', containerId: node.id, activeChildId: firstChild });
            this.emit({ type: 'tree-changed' });
            return;
        }

        const parent = this.getParentContainerById(node.parentId);
        if (parent && parent.type === 'tab') {
            parent.activeChildId = node.id;
            const floatingRootId = this.findFloatingRootId(parent.id);
            if (floatingRootId) {
                this.syncFloatingActiveNode(floatingRootId);
            }
            this.emit({ type: 'active-changed', containerId: parent.id, activeChildId: node.id });
            this.emit({ type: 'tree-changed' });
        }
    }

    public dispose(): void {
        this.nodesMap.clear();
        this.titleDisposers.forEach(dispose => dispose());
        this.titleDisposers.clear();
        this.rootId = null;
        this.floatingRootsMap.clear();
        this.floatingNodeIndex.clear();
        this.listeners.clear();
    }

    public updateSplitRatio(splitId: string, dividerIndex: number, ratio: number): void {
        const node = this.nodesMap.get(splitId);
        if (!node || node.type !== 'split') {
            return;
        }
        const splitNode = node as SplitContainerNode;
        if (dividerIndex < 0 || dividerIndex >= splitNode.ratios.length) {
            return;
        }
        const clamped = Math.max(0.1, Math.min(0.9, ratio));
        if (Math.abs(splitNode.ratios[dividerIndex] - clamped) < 0.0001) {
            return;
        }
        splitNode.ratios[dividerIndex] = clamped;
        this.emit({ type: 'tree-changed' });
    }

    public detachSimpleWindow(
        descriptor: {
            nodeId: string;
            x: number;
            y: number;
            width: number;
            height: number;
            snapped: boolean;
            restoreWidth?: number;
            restoreHeight?: number;
            zIndex?: number;
        }
    ): void {
        const node = this.requireNode<SimpleWindowNode>(descriptor.nodeId, 'simple');

        let restoreWidth = descriptor.restoreWidth;
        let restoreHeight = descriptor.restoreHeight;

        const existingRootId = this.findFloatingRootId(node.id);
        const existingFloating = existingRootId ? this.floatingRootsMap.get(existingRootId) ?? null : null;

        if (restoreWidth === undefined || restoreHeight === undefined) {
            const storedSize = node.floatingSize ?? node.window.getDefaultFloatingSize();
            if (storedSize) {
                restoreWidth = restoreWidth ?? storedSize.width;
                restoreHeight = restoreHeight ?? storedSize.height;
            }
        }

        const elementRect = node.window.getElement().getBoundingClientRect();
        const widthFallback =
            (descriptor.width && descriptor.width > 1 ? descriptor.width : undefined) ??
            existingFloating?.width ??
            restoreWidth ??
            (elementRect.width || 320);
        const heightFallback =
            (descriptor.height && descriptor.height > 1 ? descriptor.height : undefined) ??
            existingFloating?.height ??
            restoreHeight ??
            (elementRect.height || 240);

        const computedWidth = Math.max(1, widthFallback);
        const computedHeight = Math.max(1, heightFallback);

        const computedX =
            Number.isFinite(descriptor.x) && descriptor.x !== undefined
                ? descriptor.x
                : existingFloating?.x ?? 0;
        const computedY =
            Number.isFinite(descriptor.y) && descriptor.y !== undefined
                ? descriptor.y
                : existingFloating?.y ?? 0;

        if (node.parentId === null) {
            const rootId = existingRootId ?? node.id;
            const activeNodeId = this.resolveActiveNodeIdFrom(rootId) ?? node.id;
            const nextDescriptor: FloatingWindowDescriptor = {
                rootId,
                activeNodeId,
                x: computedX,
                y: computedY,
                width: computedWidth,
                height: computedHeight,
                snapped: descriptor.snapped,
                zIndex: descriptor.zIndex ?? existingFloating?.zIndex ?? ++this.floatingZCounter,
                restoreWidth,
                restoreHeight
            };
            this.floatingRootsMap.set(rootId, nextDescriptor);
            this.reindexFloatingRoot(rootId);
            this.emit({ type: 'floating-changed', rootId, floating: true });
            return;
        }

        const previousRootId = existingRootId;
        this.detachSimpleNode(node);
        const tabRoot = this.wrapInStandaloneTab(node);
        this.nodesMap.set(tabRoot.id, tabRoot);

        const activeNodeId = tabRoot.activeChildId || node.id;
        const nextDescriptor: FloatingWindowDescriptor = {
            rootId: tabRoot.id,
            activeNodeId,
            x: computedX,
            y: computedY,
            width: computedWidth,
            height: computedHeight,
            snapped: descriptor.snapped,
            zIndex: descriptor.zIndex ?? existingFloating?.zIndex ?? ++this.floatingZCounter,
            restoreWidth,
            restoreHeight
        };

        this.floatingRootsMap.set(tabRoot.id, nextDescriptor);
        this.reindexFloatingRoot(tabRoot.id);

        if (previousRootId) {
            this.reindexFloatingRoot(previousRootId);
        }

        this.emit({ type: 'tree-changed' });
        this.emit({ type: 'floating-changed', rootId: tabRoot.id, floating: true });
    }

    public getFloatingContent(rootId: string): WindowTreeNode | null {
        return this.nodesMap.get(rootId) ?? null;
    }

    public setFloatingWindow(descriptor: FloatingWindowDescriptor): void {
        const existing = this.floatingRootsMap.get(descriptor.rootId);
        const zIndex = descriptor.zIndex ?? existing?.zIndex ?? ++this.floatingZCounter;
        const nextDescriptor: FloatingWindowDescriptor = {
            rootId: descriptor.rootId,
            activeNodeId:
                descriptor.activeNodeId ??
                existing?.activeNodeId ??
                this.resolveActiveNodeIdFrom(descriptor.rootId) ??
                '',
            x: descriptor.x,
            y: descriptor.y,
            width: descriptor.width,
            height: descriptor.height,
            snapped: descriptor.snapped,
            zIndex,
            restoreWidth: descriptor.restoreWidth ?? existing?.restoreWidth,
            restoreHeight: descriptor.restoreHeight ?? existing?.restoreHeight
        };
        this.floatingRootsMap.set(descriptor.rootId, nextDescriptor);
        this.emit({ type: 'floating-changed', rootId: descriptor.rootId, floating: true });
    }

    public bringFloatingToFront(rootId: string): void {
        const descriptor = this.floatingRootsMap.get(rootId);
        if (!descriptor) {
            return;
        }
        descriptor.zIndex = ++this.floatingZCounter;
        this.floatingRootsMap.set(rootId, descriptor);
        this.emit({ type: 'floating-changed', rootId, floating: true });
    }

    public removeFloatingWindow(nodeId: string): void {
        const rootId = this.findFloatingRootId(nodeId);
        if (!rootId) {
            return;
        }

        const floatingDescriptor = this.floatingRootsMap.get(rootId);
        const node = this.nodesMap.get(nodeId);

        if (floatingDescriptor && node && node.type === 'simple') {
            node.floatingSize = {
                width: floatingDescriptor.restoreWidth ?? floatingDescriptor.width,
                height: floatingDescriptor.restoreHeight ?? floatingDescriptor.height
            };
        }

        this.clearFloatingIndexForRoot(rootId);

        if (this.floatingRootsMap.delete(rootId)) {
            this.emit({ type: 'floating-changed', rootId, floating: false });
        }
    }

    public setFloatingAsRoot(rootId: string): void {
        const rootNode = this.nodesMap.get(rootId);
        if (!rootNode) {
            return;
        }

        // Remove from floating map
        const floatingDescriptor = this.floatingRootsMap.get(rootId);
        if (floatingDescriptor) {
            const node = this.nodesMap.get(rootId);
            if (node && node.type === 'simple') {
                node.floatingSize = {
                    width: floatingDescriptor.restoreWidth ?? floatingDescriptor.width,
                    height: floatingDescriptor.restoreHeight ?? floatingDescriptor.height
                };
            }
            this.clearFloatingIndexForRoot(rootId);
            this.floatingRootsMap.delete(rootId);
            this.emit({ type: 'floating-changed', rootId, floating: false });
        }

        // Ensure parentId is null
        rootNode.parentId = null;

        // Set as root
        this.rootId = rootId;

        // Emit tree-changed event
        this.emit({ type: 'tree-changed' });
    }

    private reassignFloatingRoot(oldRootId: string, newRootId: string): void {
        const descriptor = this.floatingRootsMap.get(oldRootId);
        if (!descriptor) {
            return;
        }
        this.floatingRootsMap.delete(oldRootId);
        descriptor.rootId = newRootId;
        this.floatingRootsMap.set(newRootId, descriptor);
        this.reindexFloatingRoot(newRootId);
        this.emit({ type: 'floating-changed', rootId: newRootId, floating: true });
    }

    public getFloatingWindows(): FloatingWindowDescriptor[] {
        return Array.from(this.floatingRootsMap.values()).map(item => ({ ...item }));
    }

    public isFloatingRoot(nodeId: string): boolean {
        return this.floatingRootsMap.has(nodeId);
    }

    public getFloatingRootIdByNode(nodeId: string): string | null {
        return this.findFloatingRootId(nodeId);
    }

    public getFloatingDescriptor(rootId: string): FloatingWindowDescriptor | null {
        return this.floatingRootsMap.get(rootId) ?? null;
    }

    private divideTabContainer(
        container: TabContainerNode,
        direction: SplitDirection,
        newNode: SimpleWindowNode,
        target: SimpleWindowNode,
        position: PositionHint,
        scope: OperationScope
    ): SimpleWindowNode {
        const parent = this.getParentContainerById(container.parentId);
        
        // Check for node promotion: if parent is split with same direction, add to parent
        if (parent && parent.type === 'split' && parent.direction === direction) {
            const splitParent = parent as SplitContainerNode;
            const containerIndex = splitParent.children.indexOf(container.id);
            if (containerIndex !== -1) {
                const newTab = this.wrapInStandaloneTab(newNode);
                this.nodesMap.set(newTab.id, newTab);
                newTab.parentId = splitParent.id;
                
                if (position === 'before') {
                    splitParent.children.splice(containerIndex, 0, newTab.id);
                } else {
                    splitParent.children.splice(containerIndex + 1, 0, newTab.id);
                }
                
                // Recalculate ratios for equal distribution
                this.recalculateSplitRatios(splitParent);
                
                container.activeChildId = target.id;
                this.emit({ type: 'tree-changed' });
                return newNode;
            }
        }

        // Create new split container
        const splitContainer = this.createSplitContainerNode(direction);
        splitContainer.parentId = parent ? parent.id : null;

        const newTab = this.wrapInStandaloneTab(newNode);
        this.nodesMap.set(newTab.id, newTab);

        if (position === 'before') {
            splitContainer.children = [newTab.id, container.id];
        } else {
            splitContainer.children = [container.id, newTab.id];
        }
        splitContainer.ratios = [0.5];

        newTab.parentId = splitContainer.id;
        container.parentId = splitContainer.id;

        this.nodesMap.set(splitContainer.id, splitContainer);

        if (!parent) {
            if (scope === 'docking') {
                this.rootId = splitContainer.id;
            } else {
                this.reassignFloatingRoot(container.id, splitContainer.id);
            }
        } else if (parent.type === 'split') {
            const splitParent = parent as SplitContainerNode;
            const containerIndex = splitParent.children.indexOf(container.id);
            if (containerIndex !== -1) {
                splitParent.children[containerIndex] = splitContainer.id;
                this.recalculateSplitRatios(splitParent);
            }
        } else {
            const tabParent = parent as TabContainerNode;
            tabParent.children = tabParent.children.map((childId: string) =>
                childId === container.id ? splitContainer.id : childId
            );
            tabParent.activeChildId = splitContainer.children[0];
        }

        container.activeChildId = target.id;
        this.emit({ type: 'tree-changed' });
        return newNode;
    }

    private createSimpleNode(window: BaseWindow, options?: { headless?: boolean }): SimpleWindowNode {
        const node: SimpleWindowNode = {
            id: nextNodeId('simple'),
            type: 'simple',
            parentId: null,
            window,
            title: window.getTitle(),
            headless: options?.headless ?? false
        };

        const dispose = window.onTitleChanged(title => {
            node.title = title;
            this.emit({ type: 'tree-changed' });
        });
        this.titleDisposers.set(node.id, dispose);

        return node;
    }

    private createTabNode(): TabContainerNode {
        return {
            id: nextNodeId('tab'),
            type: 'tab',
            parentId: null,
            children: [],
            activeChildId: ''
        };
    }

    private createSplitContainerNode(direction: SplitDirection, children: string[] = []): SplitContainerNode {
        const node: SplitContainerNode = {
            id: nextNodeId('split'),
            type: 'split',
            parentId: null,
            direction,
            children: [...children],
            ratios: []
        };
        // Initialize ratios: equal distribution
        if (children.length > 1) {
            const ratioPerChild = 1 / children.length;
            for (let i = 0; i < children.length - 1; i++) {
                node.ratios.push((i + 1) * ratioPerChild);
            }
        }
        return node;
    }

    private getParentContainerById(
        parentId: string | null
    ): SplitContainerNode | TabContainerNode | null {
        if (!parentId) {
            return null;
        }
        const parent = this.nodesMap.get(parentId) ?? null;
        if (!parent) {
            return null;
        }
        if (parent.type === 'simple') {
            return null;
        }
        return parent;
    }

    private detachSimpleNode(node: SimpleWindowNode): void {
        const parentId = node.parentId;
        if (!parentId) {
            this.rootId = null;
            node.parentId = null;
            return;
        }
        const parent = this.nodesMap.get(parentId);
        if (!parent) {
            node.parentId = null;
            return;
        }

        if (parent.type === 'tab') {
            parent.children = parent.children.filter(id => id !== node.id);
            if (parent.activeChildId === node.id) {
                parent.activeChildId = parent.children[0] ?? '';
            }
            node.parentId = null;
            this.cleanupTabAfterChange(parent);
            return;
        }

        if (parent.type === 'split') {
            const splitParent = parent as SplitContainerNode;
            const nodeIndex = splitParent.children.indexOf(node.id);
            if (nodeIndex !== -1) {
                splitParent.children.splice(nodeIndex, 1);
                // Recalculate ratios after removing a child
                this.recalculateSplitRatios(splitParent);
            }
            node.parentId = null;
            this.cleanupSplitAfterChange(splitParent);
        }
    }

    private wrapInStandaloneTab(node: SimpleWindowNode): TabContainerNode {
        const tab = this.createTabNode();
        tab.children = [node.id];
        tab.activeChildId = node.id;
        tab.parentId = null;
        node.parentId = tab.id;
        node.headless = true;
        this.nodesMap.set(tab.id, tab);
        return tab;
    }

    private ensureTabContainer(node: SimpleWindowNode): TabContainerNode {
        const parentId = node.parentId;
        if (parentId) {
            const parent = this.nodesMap.get(parentId);
            if (parent && parent.type === 'tab') {
                node.headless = true;
                return parent;
            }
        }

        const tabNode = this.createTabNode();
        tabNode.children = [node.id];
        tabNode.activeChildId = node.id;
        tabNode.parentId = parentId;
        node.parentId = tabNode.id;
        node.headless = true;
        this.nodesMap.set(tabNode.id, tabNode);

        if (!parentId) {
            this.rootId = tabNode.id;
            return tabNode;
        }

        const parent = this.nodesMap.get(parentId);
        if (!parent) {
            return tabNode;
        }

        if (parent.type === 'split') {
            const splitParent = parent as SplitContainerNode;
            const nodeIndex = splitParent.children.indexOf(node.id);
            if (nodeIndex !== -1) {
                splitParent.children[nodeIndex] = tabNode.id;
                this.recalculateSplitRatios(splitParent);
            }
        } else if (parent.type === 'tab') {
            parent.children = parent.children.map(childId => (childId === node.id ? tabNode.id : childId));
            parent.activeChildId = tabNode.id;
        }

        return tabNode;
    }

    private cleanupTabAfterChange(parent: TabContainerNode): void {
        if (parent.children.length === 0) {
            this.removeNodeAndCleanup(parent);
            return;
        }

        if (!parent.children.includes(parent.activeChildId)) {
            parent.activeChildId = parent.children[0];
        }
    }

    private cleanupSplitAfterChange(parent: SplitContainerNode): void {
        if (parent.children.length === 0) {
            this.removeNodeAndCleanup(parent);
            return;
        }

        if (parent.children.length === 1) {
            const remaining = parent.children[0];
            if (remaining) {
                this.promoteSingleChildThroughParent(parent, remaining);
            } else {
                this.removeNodeAndCleanup(parent);
            }
            return;
        }

        // Recalculate ratios if children changed
        this.recalculateSplitRatios(parent);
    }

    private promoteSingleChildThroughParent(parent: WindowTreeNode, childId: string): void {
        const child = this.nodesMap.get(childId);
        if (!child) {
            return;
        }

        const grandParentId = parent.parentId;
        if (!grandParentId) {
            if (this.isFloatingRoot(parent.id)) {
                child.parentId = null;
                this.reassignFloatingRoot(parent.id, child.id);
            } else {
                this.rootId = child.id;
                child.parentId = null;
            }
        } else {
            const grand = this.nodesMap.get(grandParentId);
            if (!grand) {
                child.parentId = null;
            } else if (grand.type === 'split') {
                const splitGrand = grand as SplitContainerNode;
                const parentIndex = splitGrand.children.indexOf(parent.id);
                if (parentIndex !== -1) {
                    splitGrand.children[parentIndex] = child.id;
                    this.recalculateSplitRatios(splitGrand);
                }
                child.parentId = grand.id;
                this.cleanupSplitAfterChange(splitGrand);
            } else if (grand.type === 'tab') {
                const index = grand.children.indexOf(parent.id);
                if (index !== -1) {
                    grand.children.splice(index, 1, child.id);
                }
                child.parentId = grand.id;
                this.cleanupTabAfterChange(grand);
            }
        }

        this.nodesMap.delete(parent.id);
    }

    private removeNodeAndCleanup(parent: WindowTreeNode): void {
        const grandParentId = parent.parentId;
        this.nodesMap.delete(parent.id);

        const floatingRootId = this.findFloatingRootId(parent.id);
        if (floatingRootId) {
            this.reindexFloatingRoot(floatingRootId);
        }

        if (!grandParentId) {
            if (this.rootId === parent.id) {
                this.rootId = null;
            }
            return;
        }

        const grand = this.nodesMap.get(grandParentId);
        if (!grand) {
            return;
        }

        if (grand.type === 'split') {
            const splitGrand = grand as SplitContainerNode;
            const parentIndex = splitGrand.children.indexOf(parent.id);
            if (parentIndex !== -1) {
                splitGrand.children.splice(parentIndex, 1);
                this.recalculateSplitRatios(splitGrand);
            }
            this.cleanupSplitAfterChange(splitGrand);
        } else if (grand.type === 'tab') {
            grand.children = grand.children.filter(id => id !== parent.id);
            this.cleanupTabAfterChange(grand);
        }
    }

    private findFloatingRootId(nodeId: string | null): string | null {
        if (!nodeId) {
            return null;
        }
        if (this.floatingRootsMap.has(nodeId)) {
            return nodeId;
        }
        const mapped = this.floatingNodeIndex.get(nodeId);
        if (mapped) {
            return mapped;
        }
        const node = this.nodesMap.get(nodeId);
        if (!node) {
            return null;
        }
        return this.findFloatingRootId(node.parentId);
    }

    private resolveActiveNodeIdFrom(nodeId: string | null): string | null {
        if (!nodeId) {
            return null;
        }
        const node = this.nodesMap.get(nodeId);
        if (!node) {
            return null;
        }
        if (node.type === 'simple') {
            return node.id;
        }
        if (node.type === 'tab') {
            const tabNode = node as TabContainerNode;
            const primaryChildId = tabNode.activeChildId || tabNode.children[0] || null;
            return this.resolveActiveNodeIdFrom(primaryChildId);
        }
        const splitNode = node as SplitContainerNode;
        // Try to resolve from each child in order
        for (const childId of splitNode.children) {
            const result = this.resolveActiveNodeIdFrom(childId);
            if (result) {
                return result;
            }
        }
        return null;
    }

    private syncFloatingActiveNode(rootId: string): void {
        const descriptor = this.floatingRootsMap.get(rootId);
        if (!descriptor) {
            return;
        }
        const activeNodeId = this.resolveActiveNodeIdFrom(rootId) ?? descriptor.activeNodeId;
        if (descriptor.activeNodeId !== activeNodeId) {
            descriptor.activeNodeId = activeNodeId;
            this.floatingRootsMap.set(rootId, descriptor);
        }
    }

    private clearFloatingIndexForRoot(rootId: string): void {
        for (const [nodeId, mappedRootId] of Array.from(this.floatingNodeIndex.entries())) {
            if (mappedRootId === rootId) {
                this.floatingNodeIndex.delete(nodeId);
            }
        }
    }

    private reindexFloatingRoot(rootId: string): void {
        this.clearFloatingIndexForRoot(rootId);
        const rootNode = this.nodesMap.get(rootId);
        if (!rootNode) {
            this.floatingRootsMap.delete(rootId);
            return;
        }

        const stack: WindowTreeNode[] = [rootNode];
        let hasSimple = false;

        while (stack.length > 0) {
            const current = stack.pop()!;
            if (current.type === 'simple') {
                this.floatingNodeIndex.set(current.id, rootId);
                hasSimple = true;
                continue;
            }

            if (current.type === 'tab') {
                const tabNode = current as TabContainerNode;
                for (const childId of tabNode.children) {
                    const child = this.nodesMap.get(childId);
                    if (child) {
                        stack.push(child);
                    }
                }
                continue;
            }

            if (current.type === 'split') {
                const splitNode = current as SplitContainerNode;
                for (const childId of splitNode.children) {
                    const child = this.nodesMap.get(childId);
                    if (child) {
                        stack.push(child);
                    }
                }
            }
        }

        if (!hasSimple) {
            this.floatingRootsMap.delete(rootId);
            return;
        }

        this.syncFloatingActiveNode(rootId);
    }

    private recalculateSplitRatios(splitNode: SplitContainerNode): void {
        if (splitNode.children.length <= 1) {
            splitNode.ratios = [];
            return;
        }
        
        // Equal distribution
        const ratioPerChild = 1 / splitNode.children.length;
        splitNode.ratios = [];
        for (let i = 0; i < splitNode.children.length - 1; i++) {
            splitNode.ratios.push((i + 1) * ratioPerChild);
        }
    }

    private emit(event: WindowTreeEvent): void {
        this.listeners.forEach(listener => listener(event));
    }

    private reset(): void {
        this.nodesMap.clear();
        this.titleDisposers.forEach(dispose => dispose());
        this.titleDisposers.clear();
        this.rootId = null;
        this.floatingRootsMap.clear();
        this.floatingNodeIndex.clear();
    }
}

