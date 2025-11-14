import { Panel } from '../window/window';
import { World, WorldEventMap } from '../../engine';
import { Object3D, Scene } from 'three/webgpu';
import { Layers, SelectionCategory } from '@paleengine/core';

type LayerEntry = [string, number];
type TransformType = 'position' | 'rotation' | 'scale';
type Axis = 'x' | 'y' | 'z';

export class InspectorPanel extends Panel {
    private readonly world: World;
    private panelContainer!: HTMLElement;
    private headerRow!: HTMLElement;
    private secondaryRow!: HTMLElement;
    private enableCheckbox!: HTMLInputElement;
    private nameInput!: HTMLInputElement;
    private layerSelect!: HTMLSelectElement;
    private currentObject: Object3D | null = null;
    private transformSection!: HTMLElement;
    private transformContent!: HTMLElement;
    private transformInputs: Record<TransformType, Record<Axis, HTMLInputElement>> = {
        position: { x: null!, y: null!, z: null! },
        rotation: { x: null!, y: null!, z: null! },
        scale: { x: null!, y: null!, z: null! }
    };
    private transformExpanded: boolean = true;
    private isMounted: boolean = false;

    private readonly handleSelectionChange = (event: WorldEventMap['selectionchange']) => {
        this.refreshUI(event.selected ?? null);
    };

    private readonly handleHierarchyChange = (event: WorldEventMap['hierarchychange']) => {
        if (!event) {
            return;
        }

        if (event.type === 'remove' && event.object && this.currentObject && event.object.uuid === this.currentObject.uuid) {
            this.refreshUI(null);
            return;
        }

        if (event.type === 'refresh' && this.currentObject) {
            // Ensure controls reflect latest state (e.g., external name changes)
            this.populateControls(this.currentObject);
        }
    };

    public constructor(world: World) {
        super('Inspector');
        this.setDefaultFloatingSize({ width: 360, height: 520 });
        this.world = world;
    }

    protected override onMount(_container: HTMLElement): void {
        if (this.isMounted) {
            return;
        }
        this.isMounted = true;
        this.renderContent();
        this.attachWorldEvents();
        this.refreshUI(this.world.getSelectedObject());
    }

    protected override onUnmount(): void {
        if (!this.isMounted) {
            return;
        }
        this.isMounted = false;
        this.detachWorldEvents();
        const element = this.getElement();
        element.classList.remove('inspector-panel');
        element.innerHTML = '';
    }

    private renderContent(): void {
        const element = this.getElement();
        element.classList.add('inspector-panel');
        element.innerHTML = '';

        this.transformInputs = {
            position: { x: null!, y: null!, z: null! },
            rotation: { x: null!, y: null!, z: null! },
            scale: { x: null!, y: null!, z: null! }
        };

        this.panelContainer = document.createElement('div');
        this.panelContainer.className = 'inspector-panel__content';

        this.headerRow = document.createElement('div');
        this.headerRow.className = 'inspector-panel__row inspector-panel__row--primary';

        this.enableCheckbox = document.createElement('input');
        this.enableCheckbox.type = 'checkbox';
        this.enableCheckbox.className = 'inspector-panel__toggle';
        this.enableCheckbox.disabled = true; // Placeholder until we wire enable/disable logic
        this.headerRow.appendChild(this.enableCheckbox);

        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.className = 'inspector-panel__name-input';
        this.nameInput.placeholder = 'Object name';
        this.nameInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.commitNameChange();
                this.nameInput.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.populateControls(this.currentObject);
                this.nameInput.blur();
            }
        });
        this.nameInput.addEventListener('blur', () => {
            this.commitNameChange();
        });
        this.headerRow.appendChild(this.nameInput);

        this.secondaryRow = document.createElement('div');
        this.secondaryRow.className = 'inspector-panel__row inspector-panel__row--secondary';

        const layerLabel = document.createElement('label');
        layerLabel.className = 'inspector-panel__label';
        layerLabel.textContent = 'Layer';
        layerLabel.htmlFor = 'inspector-layer-select';
        this.secondaryRow.appendChild(layerLabel);

        this.layerSelect = document.createElement('select');
        this.layerSelect.id = 'inspector-layer-select';
        this.layerSelect.className = 'inspector-panel__layer-select';
        this.populateLayerOptions();
        this.layerSelect.addEventListener('change', () => {
            this.commitLayerChange();
        });
        this.secondaryRow.appendChild(this.layerSelect);

        this.panelContainer.appendChild(this.headerRow);
        this.panelContainer.appendChild(this.secondaryRow);

        this.createTransformSection();

        element.appendChild(this.panelContainer);

        this.setControlsEnabled(false);
    }

    private attachWorldEvents(): void {
        this.world.on('selectionchange', this.handleSelectionChange);
        this.world.on('hierarchychange', this.handleHierarchyChange);
    }

    private detachWorldEvents(): void {
        this.world.off('selectionchange', this.handleSelectionChange);
        this.world.off('hierarchychange', this.handleHierarchyChange);
    }

    private refreshUI(object: Object3D | null): void {
        if (object && (this.isSceneRoot(object) || this.shouldHide(object))) {
            object = null;
        }

        this.currentObject = object;
        this.setControlsEnabled(Boolean(object));
        this.populateControls(object);
    }

    private populateControls(object: Object3D | null): void {
        if (!this.nameInput || !this.layerSelect || !this.enableCheckbox) {
            return;
        }
        if (!object) {
            this.nameInput.value = '';
            this.layerSelect.value = '';
            this.enableCheckbox.checked = false;
            this.populateTransformControls(null);
            return;
        }

        this.nameInput.value = this.getDisplayName(object);
        this.layerSelect.value = object.layers.mask.toString();
        this.enableCheckbox.checked = object.visible;
        this.populateTransformControls(object);
    }

    private commitNameChange(): void {
        if (!this.currentObject || !this.nameInput) {
            return;
        }

        const newValue = this.nameInput.value.trim();
        if (newValue.length === 0) {
            this.populateControls(this.currentObject);
            return;
        }

        if (newValue === this.currentObject.name) {
            return;
        }

        this.currentObject.name = newValue;
        if (typeof this.world.requestHierarchyRefresh === 'function') {
            this.world.requestHierarchyRefresh();
        }
    }

    private commitLayerChange(): void {
        if (!this.currentObject || !this.layerSelect) {
            return;
        }

        const newLayer = Number(this.layerSelect.value);
        if (Number.isNaN(newLayer)) {
            return;
        }

        this.currentObject.layers.set(newLayer);
    }

    private populateLayerOptions(): void {
        if (!this.layerSelect) {
            return;
        }
        const entries: LayerEntry[] = Object.entries(Layers);
        this.layerSelect.innerHTML = '';

        entries.forEach(([name, value]) => {
            const option = document.createElement('option');
            option.value = value.toString();
            option.textContent = `${name} (${value})`;
            this.layerSelect.appendChild(option);
        });
    }

    private setControlsEnabled(enabled: boolean): void {
        if (!this.nameInput || !this.layerSelect || !this.enableCheckbox) {
            return;
        }
        this.nameInput.disabled = !enabled;
        this.layerSelect.disabled = !enabled;
        // Intentionally keep checkbox disabled (placeholder)
        this.setTransformEnabled(enabled);
    }

    private getDisplayName(object: Object3D): string {
        if ((object as Scene).isScene) {
            const name = (object.name || '').trim();
            return name.length > 0 ? name : 'Scene';
        }

        const name = (object.name || '').trim();
        return name.length > 0 ? name : object.type;
    }

    private shouldHide(object: Object3D): boolean {
        const category = object.userData?.selectionCategory;
        return category === SelectionCategory.UI_HELPER;
    }

    private isSceneRoot(object: Object3D): boolean {
        return (object as Scene).isScene === true && object.parent === null;
    }

    public dispose(): void {
        this.detachWorldEvents();
        super.dispose();
    }

    private createTransformSection(): void {
        this.transformSection = document.createElement('section');
        this.transformSection.className = 'inspector-panel__section';

        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'inspector-panel__section-header';
        header.textContent = 'Transform';
        header.addEventListener('click', () => this.toggleTransformSection());

        this.transformContent = document.createElement('div');
        this.transformContent.className = 'inspector-panel__section-content';

        this.transformContent.appendChild(this.createTransformRow('position', 'Position'));
        this.transformContent.appendChild(this.createTransformRow('rotation', 'Rotation'));
        this.transformContent.appendChild(this.createTransformRow('scale', 'Scale'));

        this.transformSection.appendChild(header);
        this.transformSection.appendChild(this.transformContent);

        this.panelContainer.appendChild(this.transformSection);
    }

    private createTransformRow(type: TransformType, label: string): HTMLElement {
        const row = document.createElement('div');
        row.className = 'inspector-panel__transform-row';

        const title = document.createElement('span');
        title.className = 'inspector-panel__transform-label';
        title.textContent = label;
        row.appendChild(title);

        ['x', 'y', 'z'].forEach(axisKey => {
            const axis = axisKey as Axis;
            const group = document.createElement('div');
            group.className = 'inspector-panel__axis-group';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'inspector-panel__axis-button';
            button.textContent = axis.toUpperCase();
            button.addEventListener('click', () => this.resetTransformValue(type, axis));

            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'decimal';
            input.className = 'inspector-panel__axis-input';
            input.addEventListener('change', () => this.commitTransformValue(type, axis));
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.commitTransformValue(type, axis);
                    input.blur();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    this.populateTransformControls(this.currentObject);
                    input.blur();
                }
            });

            group.appendChild(button);
            group.appendChild(input);
            row.appendChild(group);
            this.transformInputs[type][axis] = input;
        });

        return row;
    }

    private toggleTransformSection(): void {
        if (!this.transformSection) {
            return;
        }
        this.transformExpanded = !this.transformExpanded;
        this.transformSection.classList.toggle('is-collapsed', !this.transformExpanded);
    }

    private setTransformEnabled(enabled: boolean): void {
        (Object.keys(this.transformInputs) as TransformType[]).forEach(type => {
            (Object.keys(this.transformInputs[type]) as Axis[]).forEach(axis => {
                const input = this.transformInputs[type][axis];
                if (input) {
                    input.disabled = !enabled;
                }
            });
        });
        if (this.transformSection) {
            this.transformSection.classList.toggle('inspector-panel__section--disabled', !enabled);
        }
    }

    private populateTransformControls(object: Object3D | null): void {
        const source = object ?? undefined;
        const position = source ? source.position : undefined;
        const rotation = source ? source.rotation : undefined;
        const scale = source ? source.scale : undefined;

        this.setTransformRowValues('position', position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
        this.setTransformRowValues('rotation', rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0);
        this.setTransformRowValues('scale', scale?.x ?? 1, scale?.y ?? 1, scale?.z ?? 1);
    }

    private setTransformRowValues(type: TransformType, x: number, y: number, z: number): void {
        const inputs = this.transformInputs[type];
        if (inputs.x) {
            inputs.x.value = this.formatNumber(x);
        }
        if (inputs.y) {
            inputs.y.value = this.formatNumber(y);
        }
        if (inputs.z) {
            inputs.z.value = this.formatNumber(z);
        }
    }

    private commitTransformValue(type: TransformType, axis: Axis): void {
        if (!this.currentObject) {
            return;
        }

        const input = this.transformInputs[type][axis];
        if (!input) {
            return;
        }
        const parsed = Number.parseFloat(input.value);
        if (!Number.isFinite(parsed)) {
            this.populateTransformControls(this.currentObject);
            return;
        }

        switch (type) {
            case 'position':
                this.currentObject.position[axis] = parsed;
                break;
            case 'rotation':
                this.currentObject.rotation[axis] = parsed;
                break;
            case 'scale':
                this.currentObject.scale[axis] = parsed;
                break;
        }
        this.populateTransformControls(this.currentObject);
    }

    private resetTransformValue(type: TransformType, axis: Axis): void {
        if (!this.currentObject) {
            return;
        }

        let defaultValue = 0;
        if (type === 'scale') {
            defaultValue = 1;
        }

        switch (type) {
            case 'position':
                this.currentObject.position[axis] = defaultValue;
                break;
            case 'rotation':
                this.currentObject.rotation[axis] = defaultValue;
                break;
            case 'scale':
                this.currentObject.scale[axis] = defaultValue;
                break;
        }

        this.populateTransformControls(this.currentObject);
    }

    private formatNumber(value: number): string {
        if (!Number.isFinite(value)) {
            return '0';
        }
        const rounded = Number(value.toFixed(4));
        return rounded.toString();
    }
}


