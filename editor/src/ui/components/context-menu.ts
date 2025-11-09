import { LocalInputManager, EventTypes, InputEvent, GlobalInputManager } from '../../engine/input';

export interface ContextMenuItem {
    label: string;
    action?: (context: unknown) => void;
    children?: ContextMenuItem[];
    enabled?: boolean;
}

export interface ContextMenuOpenConfig {
    items: ContextMenuItem[];
    context?: unknown;
    position?: { x: number; y: number };
    closeOnSelect?: boolean;
}

export interface ContextMenuAttachOptions {
    closeOnSelect?: boolean;
    preventDefault?: boolean;
    stopPropagation?: boolean;
}

interface ContextMenuAttachment {
    manager: LocalInputManager;
    handler: (event: InputEvent) => void;
}

export class ContextMenu {
    private rootElement: HTMLElement | null = null;
    private currentContext: unknown = null;
    private closeOnSelect: boolean = true;
    private readonly extraClasses: string[];
    private isOpen: boolean = false;
    private attachments: ContextMenuAttachment[] = [];
    private globalUnsubscribers: Array<() => void> = [];

    private readonly handleGlobalMouseDown = (event: MouseEvent) => {
        if (!this.rootElement){
            return;
        }
        const target = event.target as Node | null;
        if (target && this.rootElement.contains(target)) {
            return;
        }
        this.close();
    };

    private readonly handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            this.close();
        }
    };

    constructor(options?: { extraClasses?: string[] }) {
        this.extraClasses = options?.extraClasses ?? [];
    }

    public attach(
        manager: LocalInputManager,
        resolver: (event: InputEvent) => ContextMenuOpenConfig | null | undefined,
        options?: ContextMenuAttachOptions
    ): void {
        const handler = (event: InputEvent) => {
            const result = resolver(event);
            if (!result || !result.items || result.items.length === 0) {
                return;
            }

            if (options?.preventDefault !== false) {
                event.preventDefault();
            }
            if (options?.stopPropagation) {
                event.stopPropagation();
            }

            const position = result.position ?? event.globalPosition;
            this.open({
                items: result.items,
                context: result.context,
                position,
                closeOnSelect: result.closeOnSelect ?? options?.closeOnSelect
            });
        };

        manager.on(EventTypes.CONTEXT_MENU, handler);
        this.attachments.push({ manager, handler });
    }

    public open(config: ContextMenuOpenConfig): void {
        if (!config.items || config.items.length === 0) {
            return;
        }

        this.close();

        const root = this.buildMenu(config.items);
        this.extraClasses.forEach(cls => root.classList.add(cls));

        this.currentContext = config.context ?? null;
        this.closeOnSelect = config.closeOnSelect ?? true;

        document.body.appendChild(root);

        const position = config.position ?? { x: 0, y: 0 };
        root.style.left = `${position.x}px`;
        root.style.top = `${position.y}px`;

        this.rootElement = root;
        this.isOpen = true;

        this.registerGlobalHandlers();

        this.constrainToViewport(root);
    }

    public close(): void {
        if (!this.isOpen) {
            return;
        }

        if (this.rootElement && this.rootElement.parentElement) {
            this.rootElement.parentElement.removeChild(this.rootElement);
        }
        this.rootElement = null;
        this.currentContext = null;
        this.isOpen = false;

        this.unregisterGlobalHandlers();
    }

    public dispose(): void {
        this.close();
        this.attachments.forEach(({ manager, handler }) => {
            manager.off(EventTypes.CONTEXT_MENU, handler);
        });
        this.attachments = [];
    }

    private buildMenu(items: ContextMenuItem[]): HTMLElement {
        const menu = document.createElement('div');
        menu.className = 'context-menu';

        items.forEach(item => {
            const element = document.createElement('div');
            element.className = 'context-menu-item';
            const isEnabled = item.enabled !== false;
            if (!isEnabled) {
                element.classList.add('context-menu-item--disabled');
            }

            const label = document.createElement('span');
            label.className = 'context-menu-item__label';
            label.textContent = item.label;
            element.appendChild(label);

            if (item.children && item.children.length > 0) {
                element.classList.add('context-menu-item--has-children');
                const arrow = document.createElement('span');
                arrow.className = 'context-menu-item__arrow';
                arrow.textContent = '▶';
                element.appendChild(arrow);

                const submenu = this.buildMenu(item.children);
                submenu.classList.add('context-menu-submenu');
                submenu.style.display = 'none';
                element.appendChild(submenu);

                element.addEventListener('mouseenter', () => {
                    submenu.style.display = 'block';
                    this.adjustSubmenuPosition(element, submenu);
                });

                element.addEventListener('mouseleave', () => {
                    submenu.style.display = 'none';
                });
            } else if (isEnabled && item.action) {
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                    item.action?.(this.currentContext);
                    if (this.closeOnSelect) {
                        this.close();
                    }
                });
            } else if (!isEnabled) {
                element.classList.add('context-menu-item--disabled');
            }

            menu.appendChild(element);
        });

        return menu;
    }

    private constrainToViewport(menu: HTMLElement): void {
        const rect = menu.getBoundingClientRect();
        let adjusted = false;
        if (rect.right > window.innerWidth) {
            menu.style.left = `${Math.max(0, window.innerWidth - rect.width)}px`;
            adjusted = true;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${Math.max(0, window.innerHeight - rect.height)}px`;
            adjusted = true;
        }

        if (adjusted) {
            const newRect = menu.getBoundingClientRect();
            if (newRect.left < 0) {
                menu.style.left = '0px';
            }
            if (newRect.top < 0) {
                menu.style.top = '0px';
            }
        }
    }

    private adjustSubmenuPosition(parentItem: HTMLElement, submenu: HTMLElement): void {
        const parentRect = parentItem.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();

        submenu.style.left = `${parentRect.width}px`;

        if (parentRect.right + submenuRect.width > window.innerWidth) {
            submenu.style.left = `-${submenuRect.width}px`;
        }

        const submenuStyle = window.getComputedStyle(submenu);
        const paddingTop = parseFloat(submenuStyle.paddingTop) || 0;
        const borderTop = parseFloat(submenuStyle.borderTopWidth) || 0;
        const baseTop = -(paddingTop + borderTop);

        let desiredTop = baseTop;
        let viewportTop = parentRect.top + desiredTop;
        let overflowBottom = viewportTop + submenuRect.height - window.innerHeight;

        if (overflowBottom > 0) {
            desiredTop -= overflowBottom;
            viewportTop -= overflowBottom;
        }

        if (viewportTop < 0) {
            desiredTop -= viewportTop;
        }

        submenu.style.top = `${desiredTop}px`;
    }

    private registerGlobalHandlers(): void {
        const globalManager = GlobalInputManager.getInstance();
        this.globalUnsubscribers.push(
            globalManager.onGlobalMouseDown(this.handleGlobalMouseDown),
            globalManager.onGlobalKeyDown(this.handleGlobalKeyDown)
        );
    }

    private unregisterGlobalHandlers(): void {
        this.globalUnsubscribers.forEach(unsub => unsub());
        this.globalUnsubscribers = [];
    }
}

