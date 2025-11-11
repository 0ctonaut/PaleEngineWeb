import { Panel } from './window';
import { World, WorldEventMap } from '../../engine';
import { Object3D, Scene } from 'three/webgpu';
import { SelectionCategory } from '@paleengine/core';
import { InputContext, InputEvent, EventTypes, LocalInputManager } from '../../engine';
import { ContextMenu, ContextMenuItem, ContextMenuOpenConfig } from './context-menu';

interface NodeEntry {
    wrapper: HTMLElement;
    children: HTMLElement;
}

export class HierarchyPanel extends Panel {
    private readonly world: World;
    private treeContainer!: HTMLElement;
    private searchInput: HTMLInputElement | null = null;
    private searchClearButton: HTMLButtonElement | null = null;
    private searchQuery: string = '';
    private readonly expandState: Map<string, boolean> = new Map();
    private readonly nodeHeaders: Map<string, HTMLElement> = new Map();
    private readonly nodeElements: Map<string, NodeEntry> = new Map();
    private readonly nodeDepth: Map<string, number> = new Map();
    private refreshScheduled: boolean = false;
    private refreshRafId: number | null = null;
    private inputManager: LocalInputManager | null = null;
    private inputContext: InputContext | null = null;
    private contextMenu: ContextMenu | null = null;
    private renamingNodeId: string | null = null;
    private renamingObject: Object3D | null = null;
    private renameInput: HTMLInputElement | null = null;
    private readonly handlePanelMouseDown = (event: InputEvent) => {
        const header = (event.target as HTMLElement | null)?.closest('.hierarchy-node__header');
        if (!header) {
            if (this.renamingNodeId) {
                this.finishRenaming(true);
            }
            this.world.setSelectedObject(null);
            this.updateSelectionHighlight(null);
        }
    };

    private readonly handleHierarchyChange = (event: WorldEventMap['hierarchychange']) => {
        if (!event) {
            return;
        }

        if (event.type === 'add' && event.object) {
            this.handleObjectAdded(event.object as Object3D);
        } else if (event.type === 'remove' && event.object) {
            this.handleObjectRemoved(event.object as Object3D, event.parent ?? null);
        } else {
            this.scheduleRefresh();
        }
    };

    private readonly handleSelectionChange = (event: WorldEventMap['selectionchange']) => {
        const selected = event.selected;
        if (this.renamingNodeId && (!selected || selected.uuid !== this.renamingNodeId)) {
            this.finishRenaming(true);
        }
        if (selected && (this.isSceneRoot(selected) || this.shouldHide(selected))) {
            this.updateSelectionHighlight(null);
            return;
        }

        const expanded = selected ? this.expandAncestors(selected) : false;
        if (expanded) {
            this.scheduleRefresh();
        } else {
            this.updateSelectionHighlight(selected);
        }

        if (selected) {
            const header = this.nodeHeaders.get(selected.uuid);
            if (header) {
                const category = header.querySelector('.hierarchy-node__category');
                if (category) {
                    (category as HTMLElement).textContent = this.getCategorySymbol(selected);
                }

                const label = header.querySelector('.hierarchy-node__label');
                if (label) {
                    (label as HTMLElement).textContent = this.getDisplayName(selected);
                }
            }
        }
    };

    public constructor(world: World) {
        super('Hierarchy');
        this.world = world;
        this.renderContent();
        this.setupInteraction();
        this.world.on('hierarchychange', this.handleHierarchyChange);
        this.world.on('selectionchange', this.handleSelectionChange);
        this.refreshTree();
        this.updateSelectionHighlight(this.world.getSelectedObject());
    }

    private renderContent(): void {
        const content = this.getElement();
        content.classList.add('hierarchy-panel');

        const searchContainer = document.createElement('div');
        searchContainer.className = 'hierarchy-search';

        const searchButton = document.createElement('button');
        searchButton.type = 'button';
        searchButton.className = 'hierarchy-search__button';
        searchButton.textContent = '🔍';
        searchButton.addEventListener('click', () => {
            this.searchInput?.focus();
            this.searchInput?.select();
        });

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'hierarchy-search__input';
        searchInput.placeholder = 'Search object...';
        searchInput.value = this.searchQuery;
        searchInput.addEventListener('input', (event) => {
            const target = event.target as HTMLInputElement;
            this.updateSearchQuery(target.value);
        });

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'hierarchy-search__clear';
        clearButton.textContent = '✕';
        clearButton.addEventListener('click', () => {
            this.updateSearchQuery('');
            this.searchInput?.focus();
        });

        searchContainer.appendChild(searchButton);
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(clearButton);
        this.searchInput = searchInput;
        this.searchClearButton = clearButton;

        content.appendChild(searchContainer);
        this.refreshSearchUI();

        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'hierarchy-tree';
        content.appendChild(this.treeContainer);
    }

    private setupInteraction(): void {
        const context = new InputContext({
            name: 'hierarchy-panel',
            priority: 5
        });
        context.activate();
        this.inputContext = context;

        this.inputManager = new LocalInputManager(this.treeContainer, context);
        this.contextMenu = new ContextMenu({
            extraClasses: ['hierarchy-context-menu']
        });

        this.contextMenu.attach(this.inputManager, (event: InputEvent) => this.resolveContextMenu(event));
        this.inputManager.on(EventTypes.MOUSE_DOWN, this.handlePanelMouseDown);
    }

    private refreshTree(): void {
        const scene = this.world.getScene();
        this.ensureRootExpanded(scene);

        this.treeContainer.innerHTML = '';
        this.nodeHeaders.clear();
        this.nodeElements.clear();
        this.nodeDepth.clear();

        if (this.hasActiveFilter()) {
            const matches = this.collectMatchingObjects(scene);
            matches.forEach(match => {
                const nodeElement = this.createNode(match, 0, { showToggle: false });
                this.treeContainer.appendChild(nodeElement);
            });
        } else {
            this.buildTreeRecursive(scene, 0, this.treeContainer);
        }

        this.refreshSearchUI();
        this.updateSelectionHighlight(this.world.getSelectedObject());
    }

    private buildTreeRecursive(object: Object3D | Scene, depth: number, parentContainer: HTMLElement): void {
        if (this.isSceneRoot(object as Object3D)) {
            this.getVisibleChildren(object).forEach(child => {
                this.buildTreeRecursive(child, depth, parentContainer);
            });
            return;
        }

        if (this.shouldHide(object as Object3D)) {
            return;
        }

        const nodeElement = this.createNode(object as Object3D, depth);
        parentContainer.appendChild(nodeElement);

        this.updateToggleState(object as Object3D);
        this.updateNodeExpansion(object as Object3D);
    }

    private createNode(object: Object3D, depth: number, options: { showToggle?: boolean } = {}): HTMLElement {
        const { showToggle = true } = options;
        const wrapper = document.createElement('div');
        wrapper.className = 'hierarchy-node';
        wrapper.dataset.uuid = object.uuid;

        const header = document.createElement('div');
        header.className = 'hierarchy-node__header';
        header.style.setProperty('--depth', depth.toString());
        header.dataset.uuid = object.uuid;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'hierarchy-node__toggle';
        if (showToggle) {
            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                this.toggleNode(object);
            });
        } else {
            toggle.classList.add('hierarchy-node__toggle--hidden');
            toggle.disabled = true;
            toggle.tabIndex = -1;
        }
        header.appendChild(toggle);

        const category = document.createElement('span');
        category.className = 'hierarchy-node__category';
        category.textContent = this.getCategorySymbol(object);
        header.appendChild(category);

        const label = document.createElement('span');
        label.className = 'hierarchy-node__label';
        label.textContent = this.getDisplayName(object);
        header.appendChild(label);

        header.addEventListener('click', () => {
            this.handleNodeSelection(object);
        });

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'hierarchy-node__children';

        wrapper.appendChild(header);
        wrapper.appendChild(childrenContainer);

        this.nodeHeaders.set(object.uuid, header);
        this.nodeElements.set(object.uuid, { wrapper, children: childrenContainer });
        this.nodeDepth.set(object.uuid, depth);

        if (this.renamingNodeId === object.uuid) {
            this.renderRenameInput(object, label);
        }

        return wrapper;
    }

    private renderChildren(object: Object3D, container: HTMLElement, depth: number): void {
        if (!this.isExpanded(object)) {
            this.removeChildrenEntries(container);
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        this.removeChildrenEntries(container);

        this.getVisibleChildren(object).forEach(child => {
            this.buildTreeRecursive(child, depth, container);
        });
    }

    private removeChildrenEntries(container: HTMLElement): void {
        const wrappers = Array.from(container.children) as HTMLElement[];
        wrappers.forEach(wrapper => {
            const uuid = wrapper.dataset.uuid;
            if (uuid) {
                this.removeMapsForUuid(uuid);
            }
        });
        container.innerHTML = '';
    }

    private removeMapsForUuid(uuid: string): void {
        const entry = this.nodeElements.get(uuid);
        if (!entry) {
            return;
        }

        this.removeChildrenEntries(entry.children);

        if (entry.wrapper.parentElement) {
            entry.wrapper.parentElement.removeChild(entry.wrapper);
        }

        this.nodeElements.delete(uuid);
        this.nodeHeaders.delete(uuid);
        this.nodeDepth.delete(uuid);
        this.expandState.delete(uuid);
    }

    private updateToggleState(object: Object3D): void {
        const header = this.nodeHeaders.get(object.uuid);
        if (!header) return;

        const toggle = header.querySelector('.hierarchy-node__toggle') as HTMLElement | null;
        if (!toggle) return;

        const hasVisibleChildren = this.getVisibleChildren(object).length > 0;
        toggle.classList.toggle('is-empty', !hasVisibleChildren);
        toggle.classList.toggle('is-collapsed', !this.isExpanded(object));
        toggle.setAttribute('aria-hidden', String(!hasVisibleChildren));
        toggle.setAttribute('aria-expanded', String(this.isExpanded(object)));
        header.classList.toggle('is-collapsed', !this.isExpanded(object));
        header.classList.toggle('hierarchy-node__header--leaf', !hasVisibleChildren);
    }

    private updateNodeExpansion(object: Object3D): void {
        const entry = this.nodeElements.get(object.uuid);
        if (!entry) {
            return;
        }

        const depth = (this.nodeDepth.get(object.uuid) ?? 0) + 1;
        this.renderChildren(object, entry.children, depth);
        this.updateToggleState(object);
    }

    private getDisplayName(object: Object3D): string {
        if ((object as Scene).isScene) {
            const sceneName = (object.name || '').trim();
            return sceneName.length > 0 ? sceneName : 'Scene';
        }

        const name = (object.name || '').trim();
        return name.length > 0 ? name : object.type;
    }

    private getCategorySymbol(_object: Object3D): string {
        return '@';
    }

    private updateSearchQuery(query: string): void {
        if (this.searchQuery === query) {
            return;
        }
        this.searchQuery = query;
        this.refreshSearchUI();
        this.scheduleRefresh();
    }

    private hasActiveFilter(): boolean {
        return this.searchQuery.trim().length > 0;
    }

    private matchesSearch(object: Object3D | Scene): boolean {
        if (!this.hasActiveFilter()) {
            return true;
        }

        const query = this.searchQuery.trim().toLowerCase();
        if (query.length === 0) {
            return true;
        }

        const name = this.getDisplayName(object as Object3D).toLowerCase();
        return name.includes(query);
    }

    private getVisibleChildren(object: Object3D | Scene): Object3D[] {
        return object.children.filter(child => !this.shouldHide(child));
    }

    private collectMatchingObjects(object: Object3D | Scene, results: Object3D[] = []): Object3D[] {
        if (!this.isSceneRoot(object as Object3D) && !this.shouldHide(object as Object3D) && this.matchesSearch(object)) {
            results.push(object as Object3D);
        }

        this.getVisibleChildren(object).forEach(child => {
            this.collectMatchingObjects(child, results);
        });

        return results;
    }

    private refreshSearchUI(): void {
        if (this.searchInput && this.searchInput.value !== this.searchQuery) {
            this.searchInput.value = this.searchQuery;
        }

        if (this.searchClearButton) {
            const hasValue = this.searchQuery.trim().length > 0;
            this.searchClearButton.classList.toggle('is-visible', hasValue);
        }
    }

    private resolveContextMenu(event: InputEvent): ContextMenuOpenConfig | null {
        const header = (event.target as HTMLElement | null)?.closest('.hierarchy-node__header') as HTMLElement | null;
        let target: Object3D | Scene | null = null;

        if (header) {
            const uuid = header.dataset.uuid;
            if (uuid) {
                target = this.findObjectByUuid(uuid);
            }
        } else {
            target = this.world.getScene();
        }

        if (!target) {
            return null;
        }

        if (target instanceof Object3D && this.shouldHide(target)) {
            return null;
        }

        const items = this.getContextMenuItems(target);
        if (items.length === 0) {
            return null;
        }

        return {
            items,
            context: { target },
            position: event.globalPosition
        };
    }

    private getContextMenuItems(target: Object3D | Scene): ContextMenuItem[] {
        const parent = target as Object3D;

        const create3DItems: ContextMenuItem[] = [
            {
                label: 'Cube',
                action: () => this.handleCreatePrimitive('cube', parent)
            },
            {
                label: 'Sphere',
                action: () => this.handleCreatePrimitive('sphere', parent)
            }
        ];

        return [
            {
                label: 'Create',
                children: [
                    {
                        label: '3D',
                        children: create3DItems
                    }
                ]
            }
        ];
    }

    private handleCreatePrimitive(type: 'cube' | 'sphere', parent: Object3D): void {
        this.ensureParentExpanded(parent);
        this.world.createPrimitive(type, parent);
        if (this.nodeElements.has(parent.uuid)) {
            this.updateNodeExpansion(parent);
        } else {
            this.scheduleRefresh();
        }
    }

    private handleNodeSelection(object: Object3D): void {
        const currentSelected = this.world.getSelectedObject();

        if (currentSelected === object) {
            this.startRenaming(object);
            return;
        }

        if (this.renamingNodeId && this.renamingNodeId !== object.uuid) {
            this.finishRenaming(true);
        }

        this.world.setSelectedObject(object);
        this.updateSelectionHighlight(object);
    }

    private startRenaming(object: Object3D): void {
        if (this.renamingNodeId === object.uuid) {
            if (this.renameInput) {
                this.renameInput.focus();
                this.renameInput.select();
            }
            return;
        }

        if (this.renamingNodeId) {
            this.finishRenaming(true);
        }

        this.renamingNodeId = object.uuid;
        this.renamingObject = object;

        const header = this.nodeHeaders.get(object.uuid);
        if (!header) {
            this.scheduleRefresh();
            return;
        }

        const labelElement = header.querySelector('.hierarchy-node__label') as HTMLElement | null;
        if (!labelElement) {
            this.scheduleRefresh();
            return;
        }

        this.renderRenameInput(object, labelElement);
    }

    private renderRenameInput(object: Object3D, labelElement: HTMLElement): void {
        if (this.renameInput && this.renameInput !== labelElement) {
            this.renameInput.remove();
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'hierarchy-node__label-input';
        input.value = this.getDisplayName(object);
        input.style.flex = '1';
        input.setAttribute('spellcheck', 'false');

        labelElement.replaceWith(input);
        this.renameInput = input;
        this.renamingObject = object;

        const commit = () => this.finishRenaming(true);
        const cancel = () => this.finishRenaming(false);

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                commit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
            }
        });

        input.addEventListener('blur', () => {
            commit();
        });

        requestAnimationFrame(() => {
            input.focus();
            input.select();
        });
    }

    private finishRenaming(commit: boolean): void {
        if (!this.renamingNodeId) {
            return;
        }

        const input = this.renameInput;
        const object = this.renamingObject || (this.findObjectByUuid(this.renamingNodeId) as Object3D | null);

        this.renamingNodeId = null;
        this.renamingObject = null;
        this.renameInput = null;

        if (commit && object) {
            const value = (input?.value || '').trim();
            object.name = value.length > 0 ? value : this.getDefaultName(object);
        }

        if (input) {
            input.remove();
        }

        this.refreshTree();
    }

    private getDefaultName(object: Object3D): string {
        if ((object as Scene).isScene) {
            return 'Scene';
        }
        return object.type;
    }

    private toggleNode(object: Object3D): void {
        const current = this.isExpanded(object);
        this.expandState.set(object.uuid, !current);
        this.updateNodeExpansion(object);
    }

    private ensureRootExpanded(scene: Scene): void {
        if (!this.expandState.has(scene.uuid)) {
            this.expandState.set(scene.uuid, true);
        }
    }

    private isExpanded(object: Object3D): boolean {
        const stored = this.expandState.get(object.uuid);
        if (stored === undefined) {
            const isRoot = (object as Scene).isScene || object.parent === null;
            this.expandState.set(object.uuid, isRoot);
            return isRoot;
        }
        return stored;
    }

    private updateSelectionHighlight(selected: Object3D | null): void {
        const selectedUuid = selected?.uuid ?? null;
        this.nodeHeaders.forEach((header, uuid) => {
            if (uuid === selectedUuid) {
                header.classList.add('hierarchy-node__header--selected');
            } else {
                header.classList.remove('hierarchy-node__header--selected');
            }
        });
    }

    private expandAncestors(object: Object3D): boolean {
        let current = object.parent;
        let changed = false;
        while (current) {
            if (this.isSceneRoot(current)) {
                break;
            }
            if (this.shouldHide(current)) {
                current = current.parent;
                continue;
            }

            if (!this.isExpanded(current)) {
                this.expandState.set(current.uuid, true);
                this.updateNodeExpansion(current);
                changed = true;
            }
            current = current.parent;
        }
        return changed;
    }

    private handleObjectAdded(object: Object3D): void {
        if (this.shouldHide(object)) {
            return;
        }

        const parent = object.parent;
        if (!parent || this.isSceneRoot(parent)) {
            this.scheduleRefresh();
            return;
        }

        if (!this.nodeElements.has(parent.uuid)) {
            this.scheduleRefresh();
            return;
        }

        this.expandState.set(parent.uuid, true);
        this.updateNodeExpansion(parent);
        this.updateSelectionHighlight(this.world.getSelectedObject());
    }

    private handleObjectRemoved(object: Object3D, parent: Object3D | null): void {
        if (this.shouldHide(object)) {
            return;
        }

        this.removeMapsForUuid(object.uuid);

        if (parent && !this.isSceneRoot(parent) && !this.shouldHide(parent)) {
            this.updateNodeExpansion(parent);
        } else {
            this.scheduleRefresh();
        }

        this.updateSelectionHighlight(this.world.getSelectedObject());
    }

    private isSceneRoot(object: Object3D): boolean {
        return (object as Scene).isScene === true && object.parent === null;
    }

    private shouldHide(object: Object3D): boolean {
        const category = object.userData?.selectionCategory;
        return category === SelectionCategory.UI_HELPER;
    }

    private findObjectByUuid(uuid: string): Object3D | Scene | null {
        return this.world.getScene().getObjectByProperty('uuid', uuid) as Object3D | Scene | null;
    }

    private ensureParentExpanded(parent: Object3D): void {
        if (this.isSceneRoot(parent)) {
            return;
        }
        this.expandState.set(parent.uuid, true);
        this.updateNodeExpansion(parent);
    }

    public dispose(): void {
        this.world.off('hierarchychange', this.handleHierarchyChange);
        this.world.off('selectionchange', this.handleSelectionChange);
        if (this.contextMenu) {
            this.contextMenu.dispose();
            this.contextMenu = null;
        }
        if (this.inputManager) {
            this.inputManager.off(EventTypes.MOUSE_DOWN, this.handlePanelMouseDown);
            this.inputManager.dispose();
            this.inputManager = null;
        }
        if (this.inputContext) {
            this.inputContext.dispose();
            this.inputContext = null;
        }
        this.nodeHeaders.clear();
        this.nodeElements.clear();
        this.nodeDepth.clear();
        if (this.refreshRafId !== null) {
            cancelAnimationFrame(this.refreshRafId);
            this.refreshRafId = null;
            this.refreshScheduled = false;
        }
        super.dispose();
    }

    private scheduleRefresh(): void {
        if (this.refreshScheduled) {
            return;
        }

        this.refreshScheduled = true;
        this.refreshRafId = requestAnimationFrame(() => {
            this.refreshScheduled = false;
            this.refreshRafId = null;
            this.refreshTree();
        });
    }
}

