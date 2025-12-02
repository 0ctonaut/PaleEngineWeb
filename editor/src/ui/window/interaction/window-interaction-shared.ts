import { SplitDirection } from '../types';
import { WindowTreeStore } from '../window-tree-store';
import { InputEvent } from '../../../engine';

export type DragType = 'divider' | 'tab' | 'leaf' | 'floating' | 'floating-resize' | 'floating-tab';

export type PositionHint = 'before' | 'after';

export type DockSide = 'top' | 'bottom' | 'left' | 'right';

export type DockingScope = 'docking' | 'floating';

export interface DockingPreview {
    kind: 'tab' | 'simple' | 'divide' | 'workspace';
    scope: DockingScope;
    containerId?: string;
    index?: number;
    tabbar?: HTMLElement;
    left?: number;
    targetSimpleId?: string;
    position?: PositionHint;
    header?: HTMLElement;
    targetId?: string;
    targetType?: 'tab' | 'simple' | 'split';
    direction?: SplitDirection;
    side?: DockSide;
    host?: HTMLElement;
}

export interface WindowInteractionCallbacks {
    onFocusDocking: () => void;
    onFocusFloating: (nodeId: string) => void;
}

export interface DragSession {
    readonly type: DragType;
    onMove(event: MouseEvent): void;
    onUp(cancelled: boolean): void;
}

export interface PointerState {
    pointerOffset: { x: number; y: number };
    windowRect: DOMRect;
    workspaceRect: DOMRect;
}

export type MouseLikeEvent = MouseEvent | InputEvent;

export interface InteractionHost {
    readonly store: WindowTreeStore;
    readonly workspaceElement: HTMLElement;
    readonly callbacks: WindowInteractionCallbacks;
    beginSession(session: DragSession): void;
    replaceSession(session: DragSession): void;
    endSession(cancelled: boolean): void;
    createSyntheticInputEvent(event: MouseEvent): InputEvent;
    beginFloatingDragFromTab(nodeId: string, event: MouseEvent): void;
}

