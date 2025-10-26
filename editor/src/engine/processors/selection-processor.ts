import { Mesh, Raycaster, Vector2 } from 'three';
import { InputProcessor } from './input-processor';
import { EventTypes, InputEvent } from '../input';
import { SelectionCategory } from '@paleengine/core';

export class SelectionProcessor extends InputProcessor {
    private mouseDownPosition: { x: number; y: number } | null = null;
    private raycaster: Raycaster;
    private selectedMesh: Mesh | null = null;
    private clickThreshold: number = 5;

    constructor(world: any, inputManager: any) {
        super(world, inputManager);
        this.raycaster = new Raycaster();
        this.setupInputHandlers();
    }

    protected setupInputHandlers(): void {
        this.inputManager.on(EventTypes.MOUSE_DOWN, (event: InputEvent) => {
            if (!this.enabled) return;
            this.handleMouseDown(event);
        });

        this.inputManager.on(EventTypes.MOUSE_UP, (event: InputEvent) => {
            if (!this.enabled) return;
            this.handleMouseUp(event);
        });
    }

    private handleMouseDown(event: InputEvent): void {
        this.mouseDownPosition = {
            x: event.position.x,
            y: event.position.y
        };
    }

    private handleMouseUp(event: InputEvent): void {
        if (!this.mouseDownPosition) return;

        const deltaX = event.position.x - this.mouseDownPosition.x;
        const deltaY = event.position.y - this.mouseDownPosition.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < this.clickThreshold) {
            this.performSelection(event);
        }

        this.mouseDownPosition = null;
    }

    private performSelection(event: InputEvent): void {
        const camera = this.world.getCamera();
        const scene = this.world.getScene();

        const vector2 = new Vector2(
            event.normalizedPosition.x,
            event.normalizedPosition.y
        );
        
        this.raycaster.setFromCamera(vector2, camera);
        const intersects = this.raycaster.intersectObjects(scene.children, true);

        // Find first selectable object (filter out UI helpers like gizmo)
        const selectableIntersect = intersects.find(intersect => {
            const category = intersect.object.userData.selectionCategory;
            // If no category set, default is selectable
            return category === SelectionCategory.SCENE_OBJECT || !category;
        });

        if (selectableIntersect) {
            this.selectMesh(selectableIntersect.object as Mesh);
        } else {
            this.deselectMesh();
        }
    }

    private selectMesh(mesh: Mesh): void {
        this.selectedMesh = mesh;
        this.world.setSelectedMesh(mesh);
    }

    private deselectMesh(): void {
        this.selectedMesh = null;
        this.world.setSelectedMesh(null);
    }

    public getSelectedMesh(): Mesh | null {
        return this.selectedMesh;
    }

    public update(_deltaTime: number): void {
        // Selection processor usually does not need per-frame updates
    }

    public dispose(): void {
        // Clean up event listeners
        this.inputManager.off(EventTypes.MOUSE_DOWN, this.handleMouseDown);
        this.inputManager.off(EventTypes.MOUSE_UP, this.handleMouseUp);
    }
}
