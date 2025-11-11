import type { Window } from './window';

export type SplitDirection = 'horizontal' | 'vertical';

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

export class Tab {
    public readonly id: string;
    public window: Window;

    constructor(window: Window, id?: string) {
        this.id = id ?? nextId('tab');
        this.window = window;
    }

    public get title(): string {
        return this.window.getTitle();
    }
}

export class TabGroup {
    public readonly id: string;
    private tabs: Tab[] = [];
    private activeIndex: number = 0;

    constructor(tabs: Tab[] = [], activeIndex: number = 0, id?: string) {
        this.id = id ?? nextId('group');
        this.tabs = [...tabs];
        this.activeIndex = Math.min(Math.max(activeIndex, 0), Math.max(0, this.tabs.length - 1));
    }

    public getTabs(): Tab[] {
        return [...this.tabs];
    }

    public getActiveIndex(): number {
        return this.activeIndex;
    }

    public setActiveIndex(index: number): void {
        if (index >= 0 && index < this.tabs.length) {
            this.activeIndex = index;
        }
    }

    public getActiveTab(): Tab | null {
        return this.tabs[this.activeIndex] ?? null;
    }

    public addTab(tab: Tab, index?: number, activate: boolean = true): number {
        let insertIndex = index;
        if (insertIndex === undefined || insertIndex < 0 || insertIndex > this.tabs.length) {
            this.tabs.push(tab);
            insertIndex = this.tabs.length - 1;
        } else {
            this.tabs.splice(insertIndex, 0, tab);
        }

        if (activate) {
            this.activeIndex = insertIndex;
        } else if (this.activeIndex >= this.tabs.length) {
            this.activeIndex = Math.max(0, this.tabs.length - 1);
        }

        return insertIndex;
    }

    public removeTab(tab: Tab): Tab | null {
        const idx = this.tabs.indexOf(tab);
        if (idx === -1) {
            return null;
        }

        const [removed] = this.tabs.splice(idx, 1);
        if (this.activeIndex >= this.tabs.length) {
            this.activeIndex = Math.max(0, this.tabs.length - 1);
        }
        return removed ?? null;
    }

    public removeTabById(id: string): Tab | null {
        const idx = this.tabs.findIndex(tab => tab.id === id);
        if (idx === -1) return null;
        const [removed] = this.tabs.splice(idx, 1);
        if (this.activeIndex >= this.tabs.length) {
            this.activeIndex = Math.max(0, this.tabs.length - 1);
        }
        return removed ?? null;
    }

    public hasTab(id: string): boolean {
        return this.tabs.some(tab => tab.id === id);
    }

    public getTabById(id: string): Tab | null {
        return this.tabs.find(tab => tab.id === id) ?? null;
    }

    public getTabIndexById(id: string): number {
        return this.tabs.findIndex(tab => tab.id === id);
    }

    public size(): number {
        return this.tabs.length;
    }

    public moveTab(fromIndex: number, toIndex: number): void {
        if (fromIndex === toIndex) {
            return;
        }
        if (fromIndex < 0 || fromIndex >= this.tabs.length) {
            return;
        }
        const clampedTo = Math.max(0, Math.min(toIndex, this.tabs.length - 1));
        const [tab] = this.tabs.splice(fromIndex, 1);
        this.tabs.splice(clampedTo, 0, tab);
        this.activeIndex = clampedTo;
    }
}

export interface SplitNodeBase {
    id: string;
    type: 'split' | 'leaf';
}

export interface SplitLeafNode extends SplitNodeBase {
    type: 'leaf';
    group: TabGroup;
    minWidth: number;
    minHeight: number;
}

export interface SplitInternalNode extends SplitNodeBase {
    type: 'split';
    direction: SplitDirection;
    ratio: number;
    first: LayoutNode;
    second: LayoutNode;
}

export type LayoutNode = SplitLeafNode | SplitInternalNode;

export const createLeafNode = (group: TabGroup, minWidth: number, minHeight: number): SplitLeafNode => ({
    id: nextId('leaf'),
    type: 'leaf',
    group,
    minWidth,
    minHeight
});

export const createSplitNode = (
    direction: SplitDirection,
    first: LayoutNode,
    second: LayoutNode,
    ratio: number = 0.5
): SplitInternalNode => ({
    id: nextId('split'),
    type: 'split',
    direction,
    ratio: Math.max(0.1, Math.min(ratio, 0.9)),
    first,
    second
});

export const cloneLayoutNode = (node: LayoutNode): LayoutNode => {
    if (node.type === 'leaf') {
        const originalTabs = node.group.getTabs();
        const clonedTabs = originalTabs.map(tab => new Tab(tab.window, tab.id));
        return {
            id: node.id,
            type: 'leaf',
            group: new TabGroup(clonedTabs, node.group.getActiveIndex(), node.group.id),
            minWidth: node.minWidth,
            minHeight: node.minHeight
        };
    }

    return {
        id: node.id,
        type: 'split',
        direction: node.direction,
        ratio: node.ratio,
        first: cloneLayoutNode(node.first),
        second: cloneLayoutNode(node.second)
    };
};

