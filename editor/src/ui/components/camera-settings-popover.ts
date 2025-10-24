import { Popover, PopoverOptions } from './popover';
import { ParameterControl, ParameterConfig } from './parameter-control';

export class CameraSettingsPopover extends Popover {
    private cameraController: any;
    private paramControls: Map<string, ParameterControl> = new Map();

    constructor(cameraController: any) {
        super();
        this.cameraController = cameraController;
    }

    protected renderContent(): void {
        this.content.innerHTML = '';

        // Add title
        const title = document.createElement('h3');
        title.className = 'popover-title';
        title.textContent = 'Camera Settings';
        this.content.appendChild(title);

        // Read current config from controller
        const currentConfig = this.cameraController.getConfig();

        const params: ParameterConfig[] = [
            {
                key: 'rotateSensitivity',
                label: 'Rotate Sensitivity',
                min: 0.001,
                max: 0.1,
                step: 0.001,
                currentValue: currentConfig.rotateSensitivity,
                defaultValue: 0.01,
                precision: 3,
                onChange: (value) => {
                    this.cameraController.updateConfig({ rotateSensitivity: value });
                }
            },
            {
                key: 'panSensitivity',
                label: 'Pan Sensitivity',
                min: 0.001,
                max: 0.1,
                step: 0.001,
                currentValue: currentConfig.panSensitivity,
                defaultValue: 0.01,
                precision: 3,
                onChange: (value) => {
                    this.cameraController.updateConfig({ panSensitivity: value });
                }
            },
            {
                key: 'zoomSensitivity',
                label: 'Zoom Sensitivity',
                min: 0.01,
                max: 1.0,
                step: 0.01,
                currentValue: currentConfig.zoomSensitivity,
                defaultValue: 0.1,
                precision: 2,
                onChange: (value) => {
                    this.cameraController.updateConfig({ zoomSensitivity: value });
                }
            },
            {
                key: 'minDistance',
                label: 'Min Distance',
                min: 0.1,
                max: 10,
                step: 0.1,
                currentValue: currentConfig.minDistance,
                defaultValue: 1,
                precision: 1,
                onChange: (value) => {
                    this.cameraController.updateConfig({ minDistance: value });
                }
            },
            {
                key: 'maxDistance',
                label: 'Max Distance',
                min: 10,
                max: 500,
                step: 1,
                currentValue: currentConfig.maxDistance,
                defaultValue: 100,
                precision: 0,
                onChange: (value) => {
                    this.cameraController.updateConfig({ maxDistance: value });
                }
            }
        ];

        params.forEach(config => {
            const control = new ParameterControl(config);
            this.paramControls.set(config.key, control);
            this.content.appendChild(control.getElement());
        });

        // Add reset camera button
        const resetButton = document.createElement('button');
        resetButton.className = 'popover-reset-button';
        resetButton.textContent = 'Reset Camera';
        resetButton.addEventListener('click', () => {
            this.cameraController.reset();
        });
        this.content.appendChild(resetButton);
    }

    // Old methods removed, now using ParameterControl component

    public showForAnchor(anchor: HTMLElement): void {
        const options: PopoverOptions = {
            anchor,
            position: 'bottom',
            alignment: 'start',
            offset: 8
        };
        super.show(options);
    }

    public toggleForAnchor(anchor: HTMLElement): void {
        const options: PopoverOptions = {
            anchor,
            position: 'bottom',
            alignment: 'start',
            offset: 8
        };
        super.toggle(options);
    }

    public dispose(): void {
        // Clean up all parameter controls
        for (const control of this.paramControls.values()) {
            control.dispose();
        }
        this.paramControls.clear();
        super.dispose();
    }
}
