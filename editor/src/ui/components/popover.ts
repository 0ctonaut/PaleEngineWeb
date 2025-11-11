import { LocalInputManager, InputContext, EventTypes, InputEvent } from '../../engine';

export type PopoverPosition = 'top' | 'bottom' | 'left' | 'right';
export type PopoverAlignment = 'start' | 'center' | 'end';

export interface PopoverOptions {
    anchor: HTMLElement;
    position?: PopoverPosition;
    alignment?: PopoverAlignment;
    offset?: number;
    maxWidth?: number;
    maxHeight?: number;
}

export abstract class Popover {
    protected element!: HTMLElement;
    protected arrow!: HTMLElement;
    protected content!: HTMLElement;
    protected isVisible: boolean = false;
    protected options!: PopoverOptions;
    
    // Input system related
    protected inputManager!: LocalInputManager;
    protected inputContext!: InputContext;

    constructor() {
        this.createPopover();
        // Do not bind events in constructor, set up input system in show()
    }

    private createPopover(): void {
        // Create Popover container
        this.element = document.createElement('div');
        this.element.className = 'popover';
        this.element.style.display = 'none';

        // Create arrow
        this.arrow = document.createElement('div');
        this.arrow.className = 'popover-arrow';

        // Create content area
        this.content = document.createElement('div');
        this.content.className = 'popover-content';

        this.element.appendChild(this.arrow);
        this.element.appendChild(this.content);
    }

    private setupInputSystem(): void {
        // Create high priority input context
        this.inputContext = new InputContext({
            name: 'popover',
            priority: 1000, // Higher than scene priority
            exclusive: true, // Exclusive mode, block event propagation
            blockPropagation: true
        });

        // Create LocalInputManager, bind to document.body
        this.inputManager = new LocalInputManager(
            document.body,
            this.inputContext
        );

        // Listen for click events
        this.inputManager.on(EventTypes.MOUSE_DOWN, (event) => {
            this.handleClick(event);
        });

        // Listen for keyboard events
        this.inputManager.on(EventTypes.KEY_DOWN, (event) => {
            if (event.key === 'Escape') {
                this.hide();
            }
        });
    }

    private handleClick = (event: InputEvent): void => {
        if (!this.isVisible) return;

        const target = event.target as HTMLElement;
        
        // Check if clicked inside Popover
        if (this.element.contains(target)) {
            return; // Clicked inside, do not close
        }

        // Check if clicked anchor element
        if (this.options?.anchor && this.options.anchor.contains(target)) {
            return; // Clicked anchor, do not close
        }

        // Clicked outside, close Popover
        this.hide();
    };

    protected abstract renderContent(): void;

    public show(options: PopoverOptions): void {
        if (this.isVisible) return;

        this.options = options;
        
        // Set up input system
        if (!this.inputContext) {
            this.setupInputSystem();
        }
        
        this.renderContent();
        document.body.appendChild(this.element);
        this.calculatePosition();
        
        // Activate input context
        this.inputContext.activate();
        
        // Show animation
        this.element.style.display = 'block';
        requestAnimationFrame(() => {
            this.element.classList.add('show');
        });

        this.isVisible = true;
    }

    public hide(): void {
        if (!this.isVisible) return;

        // Deactivate input context
        if (this.inputContext) {
            this.inputContext.deactivate();
        }

        this.element.classList.remove('show');
        
        setTimeout(() => {
            if (this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            this.element.style.display = 'none';
        }, 200);

        this.isVisible = false;
    }

    public toggle(options: PopoverOptions): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(options);
        }
    }

    private calculatePosition(): void {
        const { anchor, position = 'bottom', alignment = 'start', offset = 8 } = this.options;
        const anchorRect = anchor.getBoundingClientRect();
        const popoverRect = this.element.getBoundingClientRect();
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        let top = 0;
        let left = 0;
        let arrowPosition = 0;

        // Calculate base position
        switch (position) {
            case 'top':
                top = anchorRect.top - popoverRect.height - offset;
                left = this.calculateHorizontalPosition(anchorRect, popoverRect, alignment);
                break;
            case 'bottom':
                top = anchorRect.bottom + offset;
                left = this.calculateHorizontalPosition(anchorRect, popoverRect, alignment);
                break;
            case 'left':
                top = this.calculateVerticalPosition(anchorRect, popoverRect, alignment);
                left = anchorRect.left - popoverRect.width - offset;
                break;
            case 'right':
                top = this.calculateVerticalPosition(anchorRect, popoverRect, alignment);
                left = anchorRect.right + offset;
                break;
        }

        // Check boundaries and adjust
        const adjusted = this.adjustForViewport(top, left, popoverRect, viewport);
        top = adjusted.top;
        left = adjusted.left;

        // Set position
        this.element.style.top = `${top}px`;
        this.element.style.left = `${left}px`;

        // Set arrow position
        this.setArrowPosition(position, arrowPosition);
    }

    private calculateHorizontalPosition(anchorRect: DOMRect, popoverRect: DOMRect, alignment: PopoverAlignment): number {
        switch (alignment) {
            case 'start':
                return anchorRect.left;
            case 'center':
                return anchorRect.left + (anchorRect.width - popoverRect.width) / 2;
            case 'end':
                return anchorRect.right - popoverRect.width;
            default:
                return anchorRect.left;
        }
    }

    private calculateVerticalPosition(anchorRect: DOMRect, popoverRect: DOMRect, alignment: PopoverAlignment): number {
        switch (alignment) {
            case 'start':
                return anchorRect.top;
            case 'center':
                return anchorRect.top + (anchorRect.height - popoverRect.height) / 2;
            case 'end':
                return anchorRect.bottom - popoverRect.height;
            default:
                return anchorRect.top;
        }
    }

    private adjustForViewport(top: number, left: number, popoverRect: DOMRect, viewport: { width: number; height: number }): { top: number; left: number } {
        // Horizontal boundary check
        if (left < 8) {
            left = 8;
        } else if (left + popoverRect.width > viewport.width - 8) {
            left = viewport.width - popoverRect.width - 8;
        }

        // Vertical boundary check
        if (top < 8) {
            top = 8;
        } else if (top + popoverRect.height > viewport.height - 8) {
            top = viewport.height - popoverRect.height - 8;
        }

        return { top, left };
    }

    private setArrowPosition(position: PopoverPosition, offset: number): void {
        const arrow = this.arrow;
        
        // Reset arrow styles
        arrow.className = 'popover-arrow';
        
        switch (position) {
            case 'top':
                arrow.classList.add('arrow-bottom');
                arrow.style.left = `${offset}px`;
                break;
            case 'bottom':
                arrow.classList.add('arrow-top');
                arrow.style.left = `${offset}px`;
                break;
            case 'left':
                arrow.classList.add('arrow-right');
                arrow.style.top = `${offset}px`;
                break;
            case 'right':
                arrow.classList.add('arrow-left');
                arrow.style.top = `${offset}px`;
                break;
        }
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    public dispose(): void {
        this.hide();
        if (this.inputManager) {
            this.inputManager.dispose();
        }
        if (this.inputContext) {
            this.inputContext.dispose();
        }
    }
}
