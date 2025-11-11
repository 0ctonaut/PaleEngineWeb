import { WindowContainer } from '../window';
import { InputEvent } from '../../../engine';
import { ContextMenu, ContextMenuItem } from '../context-menu';

export class WindowContextMenu {
    private readonly contextMenu: ContextMenu;

    constructor() {
        this.contextMenu = new ContextMenu({
            extraClasses: ['window-context-menu']
        });
    }
    
    public attachToWindow(window: WindowContainer, onClose?: () => void): void {
        const inputManager = window.getInputManager();
        const getActiveTab = (): HTMLElement | null =>
            window.getElement().querySelector('.window-tab.active') as HTMLElement | null;

        this.contextMenu.attach(inputManager, (event: InputEvent) => {
            if (window.getContentType() !== 'single') {
                return null;
            }
            const activeTab = getActiveTab();
            if (!activeTab) {
                return null;
            }
            if (!event.target || !activeTab.contains(event.target as Node)) {
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

