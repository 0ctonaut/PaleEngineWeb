import { BaseWindow } from './base-window';

export type SplitDirection = 'horizontal' | 'vertical';

export type WindowTreeNodeType = 'simple' | 'tab' | 'split';

export interface WindowTreeNodeBase {
    readonly id: string;
    readonly type: WindowTreeNodeType;
    parentId: string | null;
}

export interface SimpleWindowNode extends WindowTreeNodeBase {
    readonly type: 'simple';
    window: BaseWindow;
    title: string;
    headless?: boolean;
    floatingSize?: { width: number; height: number };
}

export interface TabContainerNode extends WindowTreeNodeBase {
    readonly type: 'tab';
    children: string[];
    activeChildId: string;
}

export interface SplitContainerNode extends WindowTreeNodeBase {
    readonly type: 'split';
    direction: SplitDirection;
    ratio: number;
    firstChildId: string;
    secondChildId: string;
}

export type WindowTreeNode = SimpleWindowNode | TabContainerNode | SplitContainerNode;

export interface WindowReference {
    id: string;
    type: WindowTreeNodeType;
}

export interface WindowTreeSnapshot {
    rootId: string | null;
    nodes: Map<string, WindowTreeNode>;
}

export type WindowTreeEvent =
    | { type: 'tree-changed' }
    | { type: 'active-changed'; containerId: string; activeChildId: string }
    | { type: 'selection-changed'; nodeId: string | null }
    | { type: 'floating-changed'; rootId: string; floating: boolean };

export interface FloatingWindowDescriptor {
    rootId: string;
    activeNodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    snapped: boolean;
    zIndex?: number;
    restoreWidth?: number;
    restoreHeight?: number;
}

