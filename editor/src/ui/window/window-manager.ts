import { BaseWindow } from './base-window';
import { WindowDomRenderer } from './window-dom-renderer';
import { WindowTreeStore } from './window-tree-store';
import { SimpleWindowNode, SplitDirection, WindowTreeNode } from './types';
import { WindowInteractionManager } from './interaction/window-interaction-manager.js';

interface WindowManagerOptions {
    host: HTMLElement;
}

export class WindowManager {
    private readonly host: HTMLElement;
    private _primaryEntry: {
        store: WindowTreeStore;
        renderer: WindowDomRenderer;
        interaction: WindowInteractionManager;
        unsubscribe: (() => void) | null;
    } | null = null;

    public constructor(options: WindowManagerOptions) {
        this.host = options.host;
        this.host.classList.add('pale-window-host');
    }

    private get primaryEntry(): NonNullable<typeof this._primaryEntry> {
        if (!this._primaryEntry) {
            throw new Error('Window manager not initialized.');
        }
        return this._primaryEntry;
    }

    public createInitialWindow(window: BaseWindow, options?: { headless?: boolean }): SimpleWindowNode {
        if (this._primaryEntry) {
            throw new Error('Initial window already created.');
        }

        const store = new WindowTreeStore();
        const rootNode = store.initialize(window, options);

        this.host.innerHTML = '';

        const renderer = new WindowDomRenderer(store, this.host, {
            onActivate: (nodeId) => this.activate(nodeId)
        });

        const interaction = new WindowInteractionManager(store, this.host, {
            onFocusDocking: () => {
                // TODO: hook focus logic for docked windows if needed
            },
            onFocusFloating: (nodeId) => {
                store.bringFloatingToFront(nodeId);
            }
        });

        const unsubscribe = store.subscribe(event => {
            if (event.type === 'tree-changed') {
                // no-op for now; renderer listens via subscription internally
            }
        });

        this._primaryEntry = { store, renderer, interaction, unsubscribe };

        return rootNode;
    }

    public divideWindowWith(
        targetId: string,
        direction: SplitDirection,
        window: BaseWindow,
        position: 'before' | 'after' = 'after',
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        return this.primaryEntry.store.divideSimpleNode(targetId, direction, window, position, options);
    }

    public stackWithSimple(
        targetId: string,
        window: BaseWindow,
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        return this.primaryEntry.store.stackWithSimple(targetId, window, options);
    }

    public activate(nodeId: string): void {
        this.primaryEntry.store.activate(nodeId);
    }

    public updateSplitRatio(splitId: string, dividerIndex: number, ratio: number): void {
        this.primaryEntry.store.updateSplitRatio(splitId, dividerIndex, ratio);
    }

    public getRootId(): string | null {
        return this.primaryEntry.store.getRootId();
    }

    public getNode<T extends WindowTreeNode = WindowTreeNode>(id: string): T | null {
        return this.primaryEntry.store.getNode<T>(id);
    }

    public getWorkspaceElement(): HTMLElement {
        return this.host;
    }

    public dispose(): void {
        if (this._primaryEntry) {
            this._primaryEntry.unsubscribe?.();
            this._primaryEntry.renderer.dispose();
            this._primaryEntry.store.dispose();
            this._primaryEntry.interaction.dispose();
            this._primaryEntry = null;
        }
    }
}

