import { CameraSettingsPopover } from './camera-settings-popover';

export class Toolbar {
    private element!: HTMLElement;
    private cameraPopover: CameraSettingsPopover;

    constructor(cameraController: any) {
        this.cameraPopover = new CameraSettingsPopover(cameraController);
        this.createToolbar();
        this.bindEvents();
    }

    private createToolbar(): void {
        this.element = document.createElement('div');
        this.element.className = 'toolbar';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';

        // Camera button
        const cameraButton = document.createElement('button');
        cameraButton.className = 'toolbar-button';
        cameraButton.textContent = 'Camera';

        buttonsContainer.appendChild(cameraButton);
        this.element.appendChild(buttonsContainer);
    }

    private bindEvents(): void {
        const cameraButton = this.element.querySelector('.toolbar-button');
        if (cameraButton) {
            cameraButton.addEventListener('click', () => {
                this.cameraPopover.toggleForAnchor(cameraButton as HTMLElement);
            });
        }
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public dispose(): void {
        this.cameraPopover.dispose();
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
