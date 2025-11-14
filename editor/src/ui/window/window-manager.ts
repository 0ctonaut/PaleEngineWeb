import { BaseWindow } from './base-window';
import { WindowDomRenderer } from './window-dom-renderer';
import { WindowTreeStore } from './window-tree-store';
import { SimpleWindowNode, SplitDirection } from './types';
import { WindowInteractionManager } from './interaction/window-interaction-manager.js';

interface WindowManagerOptions {
    host: HTMLElement;
}

export class WindowManager {
    private readonly host: HTMLElement;
    private primaryEntry: {
        store: WindowTreeStore;
        renderer: WindowDomRenderer;
        interaction: WindowInteractionManager;
        unsubscribe: (() => void) | null;
    } | null = null;

    public constructor(options: WindowManagerOptions) {
        this.host = options.host;
        this.host.classList.add('pale-window-host');
    }

    public createInitialWindow(window: BaseWindow, options?: { headless?: boolean }): SimpleWindowNode {
        if (this.primaryEntry) {
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

        this.primaryEntry = { store, renderer, interaction, unsubscribe };

        return rootNode;
    }

    public divideWindowWith(
        targetId: string,
        direction: SplitDirection,
        window: BaseWindow,
        position: 'before' | 'after' = 'after',
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        const entry = this.ensurePrimaryEntry();
        return entry.store.divideSimpleNode(targetId, direction, window, position, options);
    }

    public stackWithSimple(
        targetId: string,
        window: BaseWindow,
        options?: { headless?: boolean }
    ): SimpleWindowNode {
        const entry = this.ensurePrimaryEntry();
        return entry.store.stackWithSimple(targetId, window, options);
    }

    public activate(nodeId: string): void {
        const entry = this.ensurePrimaryEntry();
        entry.store.activate(nodeId);
    }

    public getWorkspaceElement(): HTMLElement {
        return this.host;
    }

    public dispose(): void {
        if (this.primaryEntry) {
            this.primaryEntry.unsubscribe?.();
            this.primaryEntry.renderer.dispose();
            this.primaryEntry.store.dispose();
            this.primaryEntry.interaction.dispose();
            this.primaryEntry = null;
        }
    }

    private ensurePrimaryEntry(): NonNullable<typeof this.primaryEntry> {
        if (!this.primaryEntry) {
            throw new Error('Window manager not initialized.');
        }
        return this.primaryEntry;
    }
}

