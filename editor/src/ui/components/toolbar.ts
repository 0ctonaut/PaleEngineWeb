import { CameraSettingsPopover } from './camera-settings-popover';
import { World } from '../../engine';
import { loadGLBWithAnimations, AnimationController } from '@paleengine/core';

export class Toolbar {
    private element!: HTMLElement;
    private cameraPopover: CameraSettingsPopover;
    private world: World;
    private fileMenu: HTMLElement | null = null;
    private fileButton: HTMLElement | null = null;

    constructor(cameraController: any, world: World) {
        this.world = world;
        this.cameraPopover = new CameraSettingsPopover(cameraController);
        this.createToolbar();
        this.bindEvents();
    }

    private createToolbar(): void {
        this.element = document.createElement('div');
        this.element.className = 'toolbar';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';

        // File menu container (relative positioning)
        const fileMenuContainer = document.createElement('div');
        fileMenuContainer.className = 'toolbar-menu-container';
        
        // File menu button
        this.fileButton = document.createElement('button');
        this.fileButton.className = 'toolbar-button';
        this.fileButton.textContent = 'File';
        fileMenuContainer.appendChild(this.fileButton);

        // File dropdown menu
        this.fileMenu = document.createElement('div');
        this.fileMenu.className = 'toolbar-menu';
        this.fileMenu.style.display = 'none';

        const loadItem = document.createElement('div');
        loadItem.className = 'toolbar-menu-item';
        loadItem.textContent = 'Load';
        loadItem.addEventListener('click', () => {
            this.handleLoad();
            this.hideFileMenu();
        });
        this.fileMenu.appendChild(loadItem);

        fileMenuContainer.appendChild(this.fileMenu);
        buttonsContainer.appendChild(fileMenuContainer);

        // Camera button
        const cameraButton = document.createElement('button');
        cameraButton.className = 'toolbar-button';
        cameraButton.textContent = 'Camera';

        buttonsContainer.appendChild(cameraButton);
        this.element.appendChild(buttonsContainer);
    }

    private bindEvents(): void {
        // File menu button click
        if (this.fileButton) {
            this.fileButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFileMenu();
            });
        }

        // Click outside to close menu
        document.addEventListener('click', (e) => {
            if (this.fileMenu && this.fileMenu.style.display !== 'none') {
                if (!this.fileMenu.contains(e.target as Node) && 
                    !this.fileButton?.contains(e.target as Node)) {
                    this.hideFileMenu();
                }
            }
        });

        // Camera button
        const cameraButton = this.element.querySelector('.toolbar-button:last-child');
        if (cameraButton) {
            cameraButton.addEventListener('click', () => {
                this.cameraPopover.toggleForAnchor(cameraButton as HTMLElement);
            });
        }
    }

    private toggleFileMenu(): void {
        if (this.fileMenu) {
            if (this.fileMenu.style.display === 'none') {
                this.showFileMenu();
            } else {
                this.hideFileMenu();
            }
        }
    }

    private showFileMenu(): void {
        if (this.fileMenu) {
            this.fileMenu.style.display = 'block';
            // Add show class for animation
            requestAnimationFrame(() => {
                this.fileMenu?.classList.add('show');
            });
        }
    }

    private hideFileMenu(): void {
        if (this.fileMenu) {
            this.fileMenu.classList.remove('show');
            // Wait for animation to complete before hiding
            setTimeout(() => {
                if (this.fileMenu) {
                    this.fileMenu.style.display = 'none';
                }
            }, 200);
        }
    }

    private selectFile(accept?: string): Promise<File | null> {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            if (accept) {
                input.accept = accept;
            }
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', () => {
                const file = input.files && input.files.length > 0 ? input.files[0] : null;
                document.body.removeChild(input);
                resolve(file);
            });

            input.addEventListener('cancel', () => {
                document.body.removeChild(input);
                resolve(null);
            });

            input.click();
        });
    }

    private async handleLoad(): Promise<void> {
        try {
            const file = await this.selectFile('.glb');
            if (!file) {
                return; // User cancelled
            }

            const fileName = file.name.toLowerCase();
            if (fileName.endsWith('.glb')) {
                const objectURL = URL.createObjectURL(file);
                try {
                    // Try to load with animations first
                    const { scene, animations } = await loadGLBWithAnimations(objectURL);
                    
                    if (!scene.name || scene.name.trim().length === 0) {
                        scene.name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
                    }
                    
                    // If there are animations, create and register AnimationController
                    if (animations && animations.length > 0) {
                        const controller = new AnimationController(scene, animations);
                        this.world.registerAnimationController(controller);
                    }
                    
                    // Add the model to the scene (whether it has animations or not)
                    this.world.addObject(scene);
                } finally {
                    URL.revokeObjectURL(objectURL);
                }
            } else {
                console.error(`Unsupported file format: ${file.name}`);
                alert(`Unsupported file format. Please select a .glb file.`);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            alert(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
