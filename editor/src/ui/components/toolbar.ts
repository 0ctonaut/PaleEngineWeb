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

        // 相机按钮
        const cameraButton = document.createElement('button');
        cameraButton.className = 'toolbar-button';
        cameraButton.innerHTML = `
            <svg class="toolbar-button-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H19V9Z"/>
            </svg>
            相机
        `;

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
