import { WindowTreeStore } from './window-tree-store';
import {
    SimpleWindowNode,
    SplitContainerNode,
    TabContainerNode,
    WindowTreeNode
} from './types';

interface WindowDomRendererOptions {
    onActivate: (nodeId: string) => void;
}

export class WindowDomRenderer {
    private readonly store: WindowTreeStore;
    private readonly container: HTMLElement;
    private readonly options: WindowDomRendererOptions;
    private unsubscribe: (() => void) | null = null;
    private readonly floatingLayer: HTMLElement;

    public constructor(store: WindowTreeStore, container: HTMLElement, options: WindowDomRendererOptions) {
        this.store = store;
        this.container = container;
        this.options = options;

        this.container.classList.add('pale-window-workspace');
        this.floatingLayer = document.createElement('div');
        this.floatingLayer.className = 'pale-window-floating-layer';
        this.container.appendChild(this.floatingLayer);
        this.unsubscribe = this.store.subscribe(() => this.render());
        this.render();
    }

    public dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.container.innerHTML = '';
        this.container.classList.remove('pale-window-workspace');
    }

    private render(): void {
        const rootId = this.store.getRootId();
        const contentLayer = document.createElement('div');
        contentLayer.className = 'pale-window-root-layer';

        if (!rootId) {
            const placeholder = document.createElement('div');
            placeholder.className = 'pale-window-placeholder';
            placeholder.textContent = 'No windows';
            contentLayer.appendChild(placeholder);
        } else {
            const root = this.store.getNode(rootId);
            if (root) {
                contentLayer.appendChild(this.renderNode(root));
            }
        }

        const existingRootLayer = this.container.querySelector('.pale-window-root-layer');
        if (existingRootLayer) {
            this.container.removeChild(existingRootLayer);
        }
        this.container.insertBefore(contentLayer, this.floatingLayer);
        this.renderFloatingWindows();
    }

    private renderNode(node: WindowTreeNode): HTMLElement {
        switch (node.type) {
            case 'simple':
                return this.renderSimple(node);
            case 'tab':
                return this.renderTabContainer(node);
            case 'split':
                return this.renderSplit(node);
            default:
                return document.createElement('div');
        }
    }

    private renderSimple(node: SimpleWindowNode): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'pale-window-simple';
        wrapper.dataset.nodeId = node.id;

        if (node.headless) {
            wrapper.classList.add('pale-window-simple--headless');
        }

        const header = document.createElement('div');
        header.className = 'pale-window-simple__header';
        header.textContent = node.title;
        header.dataset.active = 'true';
        header.dataset.nodeId = node.id;
        header.addEventListener('click', () => this.options.onActivate(node.id));

        const content = document.createElement('div');
        content.className = 'pale-window-simple__content';

        if (!node.headless) {
            wrapper.appendChild(header);
        }
        wrapper.appendChild(content);

        node.window.mount(content);

        return wrapper;
    }

    private renderTabContainer(node: TabContainerNode): HTMLElement {
        const container = document.createElement('div');
        container.className = 'pale-window-tabContainer';
        container.dataset.nodeId = node.id;

        const tabbar = document.createElement('div');
        tabbar.className = 'pale-window-tabbar';

        const content = document.createElement('div');
        content.className = 'pale-window-tabcontainer__content';

        node.children.forEach(childId => {
            const child = this.store.getNode(childId);
            if (!child || child.type !== 'simple') {
                return;
            }
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'pale-window-tab';
            tab.textContent = child.title;
            tab.dataset.tabId = child.id;
            tab.dataset.active = child.id === node.activeChildId ? 'true' : 'false';
            tab.addEventListener('click', () => this.options.onActivate(child.id));
            tabbar.appendChild(tab);
        });

        const activeChild = this.store.getNode(node.activeChildId);
        if (activeChild) {
            content.appendChild(this.renderNode(activeChild));
        } else if (node.children.length > 0) {
            const fallbackChild = this.store.getNode(node.children[0]);
            if (fallbackChild) {
                content.appendChild(this.renderNode(fallbackChild));
            }
        }

        container.appendChild(tabbar);
        container.appendChild(content);
        return container;
    }

    private renderSplit(node: SplitContainerNode): HTMLElement {
        const container = document.createElement('div');
        container.className = 'pale-window-split';
        container.dataset.nodeId = node.id;

        const directionClass = node.direction === 'horizontal' ? '--horizontal' : '--vertical';
        container.classList.add(`pale-window-split${directionClass}`);

        if (node.children.length === 0) {
            return container;
        }

        // Render panes and dividers
        for (let i = 0; i < node.children.length; i++) {
            const childId = node.children[i];
            
            // Calculate ratio for this pane
            let ratio: number;
            if (i === 0) {
                ratio = node.ratios.length > 0 ? node.ratios[0] : 1;
            } else if (i === node.children.length - 1) {
                ratio = node.ratios.length > 0 ? 1 - node.ratios[node.ratios.length - 1] : 1;
            } else {
                ratio = node.ratios[i] - node.ratios[i - 1];
            }
            
            const pane = this.createSplitPane(childId, ratio, i);
            container.appendChild(pane);
            
            // Add divider after each pane except the last one
            if (i < node.children.length - 1) {
                const divider = this.createSplitDivider(node, i);
                container.appendChild(divider);
            }
        }

        return container;
    }

    private createSplitPane(childId: string, ratio: number, index: number): HTMLElement {
        const pane = document.createElement('div');
        pane.className = 'pale-window-split__pane';
        pane.dataset.pane = index === 0 ? 'first' : index === 1 ? 'second' : `pane-${index}`;
        pane.dataset.paneIndex = index.toString();

        const clamped = Math.max(Math.min(ratio, 0.9), 0.1);
        pane.style.flex = `${clamped} 1 0`;

        const child = childId ? this.store.getNode(childId) : null;
        if (child) {
            pane.appendChild(this.renderNode(child));
        }

        return pane;
    }

    private createSplitDivider(node: SplitContainerNode, dividerIndex: number): HTMLElement {
        const divider = document.createElement('div');
        divider.className = 'pale-window-split__divider';
        divider.dataset.direction = node.direction;
        divider.dataset.splitId = node.id;
        divider.dataset.dividerIndex = dividerIndex.toString();
        return divider;
    }

    private renderFloatingWindows(): void {
        this.floatingLayer.innerHTML = '';
        const floatingWindows = this.store.getFloatingWindows();
        floatingWindows.forEach(descriptor => {
            const node = this.store.getFloatingContent(descriptor.rootId);
            if (!node) {
                return;
            }
            const wrapper = document.createElement('div');
            wrapper.className = 'pale-window-floating';
            wrapper.dataset.nodeId = descriptor.rootId;
            wrapper.style.transform = `translate(${descriptor.x}px, ${descriptor.y}px)`;
            wrapper.style.width = `${descriptor.width}px`;
            wrapper.style.height = `${descriptor.height}px`;
            if (descriptor.zIndex !== undefined) {
                wrapper.style.zIndex = `${descriptor.zIndex}`;
            }

            const inner = document.createElement('div');
            inner.className = 'pale-window-floating__content';
            inner.appendChild(this.renderNode(node));
            wrapper.appendChild(inner);
            this.appendFloatingResizeHandles(wrapper);

            this.floatingLayer.appendChild(wrapper);
        });
    }

    private appendFloatingResizeHandles(wrapper: HTMLElement): void {
        const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
        handles.forEach(handle => {
            const element = document.createElement('div');
            element.className = `pale-window-floating__resize pale-window-floating__resize--${handle}`;
            element.dataset.floatingHandle = handle;
            wrapper.appendChild(element);
        });
    }
}

