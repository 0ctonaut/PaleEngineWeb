import { Window } from '../window/window';
import { InputEvent, EventTypes } from '../../../engine/input';

export class WindowContextMenu {
    private menuElement!: HTMLElement;
    
    constructor() {
        this.createMenu();
    }
    
    private createMenu(): void {
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'window-context-menu';
        this.menuElement.style.display = 'none';
        
        const closeItem = document.createElement('div');
        closeItem.className = 'context-menu-item';
        closeItem.textContent = '关闭';
        closeItem.addEventListener('click', () => {
            this.hide();
        });
        
        this.menuElement.appendChild(closeItem);
        document.body.appendChild(this.menuElement);
    }
    
    public attachToWindow(window: Window, onClose?: () => void): void {
        const inputManager = window.getInputManager();
        const titleTab = window.getElement().querySelector('.window-title-tab') as HTMLElement;
        
        if (!titleTab) return;
        
        inputManager.on(EventTypes.CONTEXT_MENU, (event: InputEvent) => {
            if (window.getContentType() === 'single' && event.target && titleTab.contains(event.target)) {
                event.preventDefault();
                this.show(event.globalPosition.x, event.globalPosition.y);
                // 如果提供了关闭回调，在菜单项点击时调用
                if (onClose) {
                    const closeItem = this.menuElement.querySelector('.context-menu-item') as HTMLElement;
                    if (closeItem) {
                        const originalHandler = closeItem.onclick;
                        closeItem.onclick = (e) => {
                            if (originalHandler) originalHandler.call(closeItem, e);
                            onClose();
                            this.hide();
                        };
                    }
                }
            }
        });
    }
    
    public show(x: number, y: number): void {
        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';
        
        // 点击其他地方关闭
        const hideHandler = (e: MouseEvent) => {
            if (!this.menuElement.contains(e.target as Node)) {
                this.hide();
                document.removeEventListener('click', hideHandler);
            }
        };
        setTimeout(() => {
            document.addEventListener('click', hideHandler);
        }, 0);
    }
    
    public hide(): void {
        this.menuElement.style.display = 'none';
    }
    
    public dispose(): void {
        if (this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
    }
}

