import { World } from '../../engine';
import { TimelineUI } from './timeline';

export class BottomBar {
    private element!: HTMLElement;
    private timeline: TimelineUI | null = null;
    private world: World | null = null;

    constructor(world: World) {
        this.world = world;
        this.createBottomBar();
    }

    private createBottomBar(): void {
        this.element = document.createElement('div');
        this.element.className = 'bottom-bar';

        // Timeline (now includes controls)
        if (this.world) {
            const timeController = this.world.getTimeController();
            this.timeline = new TimelineUI(timeController);
            this.element.appendChild(this.timeline.getElement());
        }
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public update(): void {
        // Update timeline rendering
        if (this.timeline) {
            this.timeline.render();
        }
    }

    public dispose(): void {
        if (this.timeline) {
            this.timeline.dispose();
            this.timeline = null;
        }
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
