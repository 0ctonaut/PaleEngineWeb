let windowIdCounter = 0;

const nextWindowId = (): string => `pale-window-${++windowIdCounter}`;

export type TitleChangeListener = (title: string) => void;

export abstract class BaseWindow {
    private readonly id: string = nextWindowId();
    private title: string;
    private readonly rootElement: HTMLElement;
    private mounted: boolean = false;
    private readonly titleListeners: Set<TitleChangeListener> = new Set();
    private defaultFloatingSize: { width: number; height: number } | null = null;

    protected constructor(title: string) {
        this.title = title;
        this.rootElement = document.createElement('div');
        this.rootElement.dataset.windowId = this.id;
    }

    public getId(): string {
        return this.id;
    }

    public getTitle(): string {
        return this.title;
    }

    public setTitle(title: string): void {
        if (this.title === title) {
            return;
        }
        this.title = title;
        this.titleListeners.forEach(listener => listener(title));
    }

    public onTitleChanged(listener: TitleChangeListener): () => void {
        this.titleListeners.add(listener);
        return () => {
            this.titleListeners.delete(listener);
        };
    }

    public mount(container: HTMLElement): void {
        if (this.rootElement.parentElement !== container) {
            if (this.rootElement.parentElement) {
                this.rootElement.parentElement.removeChild(this.rootElement);
            }
            container.appendChild(this.rootElement);
        }

        this.onAttach(container);

        if (!this.mounted) {
            this.mounted = true;
            this.onMount(this.rootElement);
        }
    }

    public unmount(): void {
        if (this.rootElement.parentElement) {
            this.rootElement.parentElement.removeChild(this.rootElement);
        }
    }

    public dispose(): void {
        if (this.mounted) {
            this.onUnmount();
            this.mounted = false;
        }
        this.unmount();
        this.titleListeners.clear();
    }

    public getElement(): HTMLElement {
        return this.rootElement;
    }

    public setDefaultFloatingSize(size: { width: number; height: number } | null): void {
        this.defaultFloatingSize = size;
    }

    public getDefaultFloatingSize(): { width: number; height: number } | null {
        return this.defaultFloatingSize ? { ...this.defaultFloatingSize } : null;
    }

    protected onAttach(_container: HTMLElement): void {
        // no-op by default
    }

    protected onMount(_element: HTMLElement): void {
        // to be implemented by subclasses
    }

    protected onUnmount(): void {
        // optional override
    }
}

