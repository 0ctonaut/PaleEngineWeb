import { World } from '../../engine';

export class BottomBar {
    private element!: HTMLElement;
    private playPauseButton: HTMLElement | null = null;
    private isPlaying: boolean = false;
    private world: World | null = null;

    constructor(world: World) {
        this.world = world;
        this.createBottomBar();
        this.bindEvents();
        this.updateButtonStateFromWorld();
    }

    private createBottomBar(): void {
        this.element = document.createElement('div');
        this.element.className = 'bottom-bar';

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'bottom-bar-controls';

        // Play/Pause button
        this.playPauseButton = document.createElement('button');
        this.playPauseButton.className = 'bottom-bar-button play-pause-button';
        this.playPauseButton.innerHTML = '▶'; // Play icon
        this.updateButtonState();

        controlsContainer.appendChild(this.playPauseButton);
        this.element.appendChild(controlsContainer);
    }

    private bindEvents(): void {
        if (this.playPauseButton) {
            this.playPauseButton.addEventListener('click', () => {
                this.togglePlayPause();
            });
        }
    }

    private togglePlayPause(): void {
        if (!this.world) {
            return;
        }

        if (this.isPlaying) {
            // Pause all animations
            this.world.pauseAllAnimations();
            this.isPlaying = false;
        } else {
            // Play all animations
            this.world.playAllAnimations();
            this.isPlaying = true;
        }
        this.updateButtonState();
    }

    private updateButtonStateFromWorld(): void {
        if (this.world) {
            this.isPlaying = this.world.isAnyAnimationPlaying();
            this.updateButtonState();
        }
    }

    private updateButtonState(): void {
        if (this.playPauseButton) {
            if (this.isPlaying) {
                this.playPauseButton.innerHTML = '⏸'; // Pause icon
                this.playPauseButton.setAttribute('aria-label', 'Pause');
            } else {
                this.playPauseButton.innerHTML = '▶'; // Play icon
                this.playPauseButton.setAttribute('aria-label', 'Play');
            }
        }
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public isAnimating(): boolean {
        return this.isPlaying;
    }

    public play(): void {
        if (this.world && !this.isPlaying) {
            this.world.playAllAnimations();
            this.isPlaying = true;
            this.updateButtonState();
        }
    }

    public pause(): void {
        if (this.world && this.isPlaying) {
            this.world.pauseAllAnimations();
            this.isPlaying = false;
            this.updateButtonState();
        }
    }

    public update(): void {
        // Update button state based on world animation state
        this.updateButtonStateFromWorld();
    }

    public dispose(): void {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
