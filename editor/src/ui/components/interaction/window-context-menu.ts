import { Window } from '../window/window';
import { InputEvent } from '../../../engine/input';
import { ContextMenu, ContextMenuItem } from '../context-menu';

export class WindowContextMenu {
    private readonly contextMenu: ContextMenu;

    constructor() {
        this.contextMenu = new ContextMenu({
            extraClasses: ['window-context-menu']
        });
    }
    
    public attachToWindow(window: Window, onClose?: () => void): void {
        const inputManager = window.getInputManager();
        const titleTab = window.getElement().querySelector('.window-title-tab') as HTMLElement;
        
        if (!titleTab) return;

        this.contextMenu.attach(inputManager, (event: InputEvent) => {
            if (window.getContentType() !== 'single') {
                return null;
            }
            if (!event.target || !titleTab.contains(event.target as Node)) {
                return null;
            }

            const items: ContextMenuItem[] = [
                {
                    label: '关闭',
                    action: () => {
                        onClose?.();
                    }
                }
            ];

            return {
                items,
                position: event.globalPosition,
                context: { window }
            };
        });
    }
    
    public dispose(): void {
        this.contextMenu.dispose();
    }
}

