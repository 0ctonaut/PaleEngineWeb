import {
    InputContext,
    LocalInputManager,
    GlobalInputManager,
    EventTypes,
    InputEvent
} from '../../../engine';
import { WindowTreeStore } from '../window-tree-store';
import { DockingInteraction } from './window-interaction-docking';
import { FloatingInteraction } from './window-interaction-floating';
import { DragSession, InteractionHost, WindowInteractionCallbacks } from './window-interaction-shared';

export class WindowInteractionManager {
    private readonly inputContext: InputContext;
    private readonly localInput: LocalInputManager;
    private readonly globalInput: GlobalInputManager;
    private readonly store: WindowTreeStore;
    private readonly callbacks: WindowInteractionCallbacks;
    private readonly workspaceElement: HTMLElement;

    private readonly dockingInteraction: DockingInteraction;
    private readonly floatingInteraction: FloatingInteraction;

    private activeSession: DragSession | null = null;
    private disposeGlobalMove: (() => void) | null = null;
    private disposeGlobalUp: (() => void) | null = null;

    public constructor(
        store: WindowTreeStore,
        workspaceElement: HTMLElement,
        callbacks: WindowInteractionCallbacks
    ) {
        this.store = store;
        this.callbacks = callbacks;
        this.workspaceElement = workspaceElement;
        this.globalInput = GlobalInputManager.getInstance();

        const host: InteractionHost = {
            store: this.store,
            workspaceElement: this.workspaceElement,
            callbacks: this.callbacks,
            beginSession: (session: DragSession) => this.beginSession(session),
            replaceSession: (session: DragSession) => this.replaceSession(session),
            endSession: (cancelled: boolean) => this.endSession(cancelled),
            createSyntheticInputEvent: (event: MouseEvent) => this.createSyntheticInputEvent(event),
            beginFloatingDragFromTab: (nodeId: string, event: MouseEvent) => this.beginFloatingDragFromTab(nodeId, event)
        };

        this.dockingInteraction = new DockingInteraction(host);
        this.floatingInteraction = new FloatingInteraction(host);

        this.inputContext = new InputContext({ name: 'window-workspace', priority: 120 });
        this.localInput = new LocalInputManager(workspaceElement, this.inputContext);
        this.localInput.on(EventTypes.MOUSE_DOWN, (event) => this.handleMouseDown(event));
    }

    public dispose(): void {
        this.clearGlobalListeners();
        this.dockingInteraction.cancel();
        this.floatingInteraction.cancel();
        this.localInput.dispose();
        this.inputContext.dispose();
    }

    private handleMouseDown(event: InputEvent): void {
        if (typeof event.button === 'number' && event.button !== 0) {
            return;
        }
        const target = event.target as HTMLElement | null;
        if (!target) {
            return;
        }

        const floatingWrapper = target.closest<HTMLElement>('.pale-window-floating');
        if (floatingWrapper && floatingWrapper.dataset.nodeId) {
            this.callbacks.onFocusDocking();
            this.callbacks.onFocusFloating(floatingWrapper.dataset.nodeId);
        }

        const floatingSession = this.floatingInteraction.handleMouseDown(target, event);
        if (floatingSession) {
            this.beginSession(floatingSession);
            return;
        }

        const dockingSession = this.dockingInteraction.handleMouseDown(target, event);
        if (dockingSession) {
            this.beginSession(dockingSession);
        }
    }

    private beginSession(session: DragSession): void {
        this.clearGlobalListeners();
        this.activeSession = session;
        //this.setGlobalDrag(session.type);
        this.setGlobalDrag();
    }

    private replaceSession(session: DragSession): void {
        this.activeSession = session;
    }

    private endSession(cancelled: boolean): void {
        if (this.activeSession) {
            this.activeSession.onUp(cancelled);
            this.activeSession = null;
        }
        this.clearGlobalListeners();
    }

    private beginFloatingDragFromTab(nodeId: string, event: MouseEvent): void {
        this.floatingInteraction.beginFloatingDragFromTab(nodeId, event);
    }

    //private setGlobalDrag(type: DragType): void {
    private setGlobalDrag(): void {
        this.clearGlobalListeners();
        this.disposeGlobalMove = this.globalInput.onGlobalMouseMove(this.handleGlobalMove);
        this.disposeGlobalUp = this.globalInput.onGlobalMouseUp(this.handleGlobalUp);
    }

    private clearGlobalListeners(): void {
        this.disposeGlobalMove?.();
        this.disposeGlobalMove = null;
        this.disposeGlobalUp?.();
        this.disposeGlobalUp = null;
    }

    private handleGlobalMove = (event: MouseEvent): void => {
        this.activeSession?.onMove(event);
    };

    private handleGlobalUp = (): void => {
        const session = this.activeSession;
        this.activeSession = null;
        session?.onUp(false);
        this.clearGlobalListeners();
    };

    private createSyntheticInputEvent(event: MouseEvent): InputEvent {
        const workspaceRect = this.workspaceElement.getBoundingClientRect();
        const position = {
            x: event.clientX - workspaceRect.left,
            y: event.clientY - workspaceRect.top
        };
        const normalizedPosition = {
            x: workspaceRect.width > 0 ? (position.x / workspaceRect.width) * 2 - 1 : 0,
            y: workspaceRect.height > 0 ? -(position.y / workspaceRect.height) * 2 + 1 : 0
        };
        const synthetic: InputEvent = {
            type: EventTypes.MOUSE_DOWN,
            originalEvent: event,
            position,
            globalPosition: { x: event.clientX, y: event.clientY },
            normalizedPosition,
            delta: { x: 0, y: 0 },
            button: event.button,
            buttons: event.buttons,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            target: event.target as HTMLElement | undefined,
            stopPropagation: () => {
                synthetic.isPropagationStopped = true;
            },
            preventDefault: () => {
                event.preventDefault();
            },
            isPropagationStopped: false
        };
        return synthetic;
    }
}

