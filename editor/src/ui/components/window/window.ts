import { LocalInputManager, InputContext, EventTypes } from '../../../engine';
import { Tab, TabGroup, LayoutNode, createLeafNode, createSplitNode, cloneLayoutNode } from './window-layout';

export type SplitDirection = 'horizontal' | 'vertical';
const WINDOW_TAB_MIME = 'application/x-paleengine-window-tab';

type WindowManager = import('./window-manager').WindowManager;

let leafWindowIdCounter = 0;
const nextLeafWindowId = (): string => `leaf-window-${++leafWindowIdCounter}`;

export abstract class Window {
    private readonly id: string = nextLeafWindowId();
    private title: string;
    private readonly rootElement: HTMLElement;

    protected constructor(title: string) {
        this.title = title;
        this.rootElement = document.createElement('div');
        this.rootElement.classList.add('window-leaf-content');
        this.buildContent(this.rootElement);
    }

    protected abstract buildContent(container: HTMLElement): void;

    public getId(): string {
        return this.id;
    }

    public getTitle(): string {
        return this.title;
    }

    public setTitle(title: string): void {
        this.title = title;
    }

    public getElement(): HTMLElement {
        return this.rootElement;
    }

    public attach(container: HTMLElement): void {
        if (this.rootElement.parentElement) {
            this.rootElement.parentElement.removeChild(this.rootElement);
        }
        container.appendChild(this.rootElement);
    }

    public dispose(): void {
        if (this.rootElement.parentElement) {
            this.rootElement.parentElement.removeChild(this.rootElement);
        }
    }
}

interface TabDragPayload {
    tabId: string;
    groupId: string;
    containerId: string;
    width: number;
    height: number;
}

interface DetachResult {
    window: Window;
    containerEmpty: boolean;
    bounds: { width: number; height: number };
}

let containerIdCounter = 0;
const nextContainerId = (): string => `window-container-${++containerIdCounter}`;

export type WindowContainerContentType = 'single' | 'tab' | 'split';

export class WindowContainer {
    private readonly id: string = nextContainerId();
    private element!: HTMLElement;
    private contentArea!: HTMLElement;
    private inputManager!: LocalInputManager;
    private inputContext!: InputContext;
    
    private x: number = 100;
    private y: number = 100;
    private width: number = 800;
    private height: number = 600;
    private minWidth: number = 200;
    private minHeight: number = 150;
    private floatingWidth: number = this.width;
    private floatingHeight: number = this.height;
    private isDocked: boolean = false;
    private dockedEdge: 'top' | 'bottom' | 'left' | 'right' | null = null;

    private windowManager: WindowManager | null = null;

    private rootNode: LayoutNode;
    private groups: Map<string, TabGroup> = new Map();
    private tabs: Map<string, { tab: Tab; groupId: string }> = new Map();

    private tabInsertPreview: HTMLElement | null = null;
    private previewState: { groupId: string; index: number } | null = null;
    private dragState: { payload: TabDragPayload; handled: boolean } | null = null;
    private windowDragHandle: HTMLElement | null = null;

    constructor(initialWindow: Window) {
        const initialTab = new Tab(initialWindow);
        const group = new TabGroup([initialTab]);
        this.rootNode = createLeafNode(group, this.minWidth, this.minHeight);
        this.registerGroup(group);
        this.registerTab(initialTab, group);
        this.createContainerElement();
        this.setupInput();
        this.updateLayout();
        this.render();
    }

    public getId(): string {
        return this.id;
    }

    public setWindowManager(manager: WindowManager | null): void {
        this.windowManager = manager;
    }

    public getWindowManager(): WindowManager | null {
        return this.windowManager;
    }

    public getInputManager(): LocalInputManager {
        return this.inputManager;
    }

    public getInputContext(): InputContext {
        return this.inputContext;
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public getBounds(): { x: number; y: number; width: number; height: number } {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    public setPosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.updateLayout();
    }

    public setSize(width: number, height: number): void {
        this.width = Math.max(width, this.minWidth);
        this.height = Math.max(height, this.minHeight);
        if (!this.isDocked) {
            this.floatingWidth = this.width;
            this.floatingHeight = this.height;
        }
        this.updateLayout();
        this.renderLayout();
    }

    public setFloatingSize(width: number, height: number): void {
        this.floatingWidth = Math.max(width, this.minWidth);
        this.floatingHeight = Math.max(height, this.minHeight);
        if (!this.isDocked) {
            this.setSize(this.floatingWidth, this.floatingHeight);
        }
    }

    public getFloatingSize(): { width: number; height: number } {
        return { width: this.floatingWidth, height: this.floatingHeight };
    }

    public restoreFloatingSize(): void {
        this.setSize(this.floatingWidth, this.floatingHeight);
    }

    public setDockedState(isDocked: boolean, edge: 'top' | 'bottom' | 'left' | 'right' | null = null): void {
        if (isDocked) {
            if (!this.isDocked) {
                this.floatingWidth = this.width;
                this.floatingHeight = this.height;
            }
            this.isDocked = true;
            this.dockedEdge = edge;
            return;
        }

        if (this.isDocked) {
            this.isDocked = false;
            this.dockedEdge = null;
            this.setSize(this.floatingWidth, this.floatingHeight);
            return;
        }

        this.isDocked = false;
        this.dockedEdge = null;
    }

    public isDockedWindow(): boolean {
        return this.isDocked;
    }

    public getDockedEdge(): 'top' | 'bottom' | 'left' | 'right' | null {
        return this.dockedEdge;
    }

    public getContentType(): WindowContainerContentType {
        if (this.rootNode.type === 'split') {
            return 'split';
        }
        const group = this.rootNode.group;
        return group.size() > 1 ? 'tab' : 'single';
    }

    public shouldStartWindowDragFrom(target: EventTarget | null): boolean {
        if (!target || !this.windowDragHandle) {
            return false;
        }
        if (!(target instanceof Node)) {
            return false;
        }
        return this.windowDragHandle.contains(target);
    }

    public detachTab(tabId: string): DetachResult | null {
        const info = this.tabs.get(tabId);
        if (!info) {
            return null;
        }
        const group = this.groups.get(info.groupId);
        if (!group) {
            return null;
        }
        const tab = group.getTabById(tabId);
        if (!tab) {
            return null;
        }
        group.removeTab(tab);
        this.unregisterTab(tabId);
        const bounds = { width: this.width, height: this.height };
        this.pruneEmptyStructure();
        const empty = this.isEmpty();
        this.renderLayout();
        return { window: tab.window, containerEmpty: empty, bounds };
    }

    public insertDetachedTab(window: Window, targetGroupId: string, index: number, activate: boolean = true): void {
        const group = this.groups.get(targetGroupId);
        if (!group) {
            return;
        }
        const tab = new Tab(window);
        this.registerTab(tab, group);
        const insertedIndex = group.addTab(tab, index, activate);
        if (activate) {
            group.setActiveIndex(insertedIndex);
        }
        this.renderLayout();
    }

    public markExternalTabDropHandled(tabId: string): void {
        if (this.dragState && this.dragState.payload.tabId === tabId) {
            this.dragState.handled = true;
        }
    }

    public dispose(): void {
        if (this.inputManager) {
            this.inputManager.dispose();
        }
        if (this.inputContext) {
            this.inputContext.dispose();
        }
        const handled = new Set<Window>();
        for (const { tab } of this.tabs.values()) {
            if (handled.has(tab.window)) continue;
            handled.add(tab.window);
            tab.window.dispose();
        }
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.groups.clear();
        this.tabs.clear();
    }

    public getLayoutSnapshot(): LayoutNode {
        return cloneLayoutNode(this.rootNode);
    }

    private createContainerElement(): void {
        this.element = document.createElement('div');
        this.element.className = 'window';
        
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'window-content';
        
        this.element.appendChild(this.contentArea);
    }
    
    private setupInput(): void {
        this.inputContext = new InputContext({ name: 'window-container', priority: 100 });
        this.inputManager = new LocalInputManager(this.element, this.inputContext);
        this.inputManager.on(EventTypes.MOUSE_DOWN, () => {
            if (this.windowManager) {
                this.windowManager.setFocusedWindow(this);
            }
        });
    }
    
    private updateLayout(): void {
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        const dragging = this.element.classList.contains('dragging');
        if (dragging) {
            this.element.style.transform = `translate(${this.x}px, ${this.y}px)`;
            this.element.style.left = '0';
            this.element.style.top = '0';
        } else {
            this.element.style.left = `${this.x}px`;
            this.element.style.top = `${this.y}px`;
            this.element.style.transform = '';
        }
    }

    private render(): void {
        this.updateLayout();
        this.renderLayout();
    }

    private renderLayout(): void {
        this.windowDragHandle = null;
        this.contentArea.innerHTML = '';
        const root = this.renderNode(this.rootNode);
        this.contentArea.appendChild(root);
    }

    private renderNode(node: LayoutNode): HTMLElement {
        if (node.type === 'leaf') {
            return this.renderLeafNode(node);
        }
        return this.renderSplitNode(node);
    }

    private renderLeafNode(node: LayoutNode & { type: 'leaf' }): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.className = 'window-leaf';
            
            const tabBar = document.createElement('div');
            tabBar.className = 'window-tab-bar';
        tabBar.dataset.groupId = node.group.id;
        tabBar.addEventListener('dragover', (event) => this.onTabBarDragOver(event, node.group));
        tabBar.addEventListener('dragenter', (event) => this.onTabBarDragEnter(event, node.group));
        tabBar.addEventListener('dragleave', (event) => this.onTabBarDragLeave(event, node.group, tabBar));
        tabBar.addEventListener('drop', (event) => this.onTabBarDrop(event, node.group));

        const tabs = node.group.getTabs();
        tabs.forEach((tab, index) => {
            const tabElement = this.createTabElement(tab, node.group, index, node);
                tabBar.appendChild(tabElement);
            });
            
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'window-tab-content';

        const activeTab = node.group.getActiveTab();
        if (activeTab) {
            activeTab.window.attach(contentWrapper);
        }

        wrapper.appendChild(tabBar);
        wrapper.appendChild(contentWrapper);

        return wrapper;
    }

    private renderSplitNode(node: LayoutNode & { type: 'split' }): HTMLElement {
        const container = document.createElement('div');
        container.className = `window-split window-split-${node.direction}`;
        container.style.display = 'flex';
        container.style.flexDirection = node.direction === 'horizontal' ? 'row' : 'column';

        const firstPane = document.createElement('div');
        firstPane.className = 'window-split-pane';
        firstPane.style.flex = node.direction === 'horizontal' ? `${node.ratio} 1 0` : `${node.ratio} 1 0`;

        const secondPane = document.createElement('div');
        secondPane.className = 'window-split-pane';
        secondPane.style.flex = node.direction === 'horizontal'
            ? `${1 - node.ratio} 1 0`
            : `${1 - node.ratio} 1 0`;

        firstPane.appendChild(this.renderNode(node.first));
        secondPane.appendChild(this.renderNode(node.second));

        container.appendChild(firstPane);
        container.appendChild(secondPane);

        return container;
    }

    private createTabElement(tab: Tab, group: TabGroup, index: number, node: LayoutNode & { type: 'leaf' }): HTMLElement {
        const tabElement = document.createElement('div');
        tabElement.className = `window-tab ${index === group.getActiveIndex() ? 'active' : ''}`;
        tabElement.textContent = tab.title;
        tabElement.dataset.tabId = tab.id;
        tabElement.dataset.groupId = group.id;
        tabElement.dataset.windowId = this.id;
        tabElement.addEventListener('click', () => {
            group.setActiveIndex(index);
            this.renderLayout();
        });

        const useDragHandle = this.shouldUseWindowDragHandle(node, group);
        if (useDragHandle) {
            tabElement.draggable = false;
            this.windowDragHandle = tabElement;
        } else {
            tabElement.draggable = true;
            tabElement.addEventListener('dragstart', (event) => this.onTabDragStart(event, tab, group));
            tabElement.addEventListener('dragend', (event) => this.onTabDragEnd(event));
        }
        return tabElement;
    }

    private shouldUseWindowDragHandle(node: LayoutNode & { type: 'leaf' }, group: TabGroup): boolean {
        if (this.rootNode.type !== 'leaf') {
            return false;
        }
        if (this.rootNode !== node) {
            return false;
        }
        return group.size() === 1;
    }

    private onTabDragStart(event: DragEvent, tab: Tab, group: TabGroup): void {
        if (!event.dataTransfer) {
            return;
        }
        event.dataTransfer.effectAllowed = 'move';
        const payload: TabDragPayload = {
            tabId: tab.id,
            groupId: group.id,
            containerId: this.id,
            width: this.width,
            height: this.height
        };
        event.dataTransfer.setData(WINDOW_TAB_MIME, JSON.stringify(payload));
        this.dragState = { payload, handled: false };
    }

    private onTabDragEnd(event: DragEvent): void {
        if (!this.dragState) {
            return;
        }
        const payload = this.dragState.payload;
        if (!this.dragState.handled) {
            const result = this.detachTab(payload.tabId);
            if (result) {
                const clientPos = { x: event.clientX, y: event.clientY };
                if (this.windowManager) {
                    this.windowManager.spawnContainerFromDetachedWindow(result.window, clientPos, result.bounds);
                }
                if (result.containerEmpty && this.windowManager) {
                    this.windowManager.removeContainer(this);
                } else {
                    this.renderLayout();
                }
            }
        }
        this.dragState = null;
        this.hideTabInsertPreview();
    }

    private onTabBarDragEnter(event: DragEvent, _group: TabGroup): void {
        if (!this.getDragPayload(event)) {
            return;
        }
        event.preventDefault();
    }

    private onTabBarDragOver(event: DragEvent, group: TabGroup): void {
        const payload = this.getDragPayload(event);
        if (!payload) {
            return;
        }
        event.preventDefault();
        const tabBar = event.currentTarget as HTMLElement;
        const index = this.computeInsertIndex(tabBar, event.clientX);
        this.showTabInsertPreview(tabBar, index);
        this.previewState = { groupId: group.id, index };
    }

    private onTabBarDragLeave(event: DragEvent, _group: TabGroup, tabBar: HTMLElement): void {
        if (!tabBar.contains(event.relatedTarget as Node)) {
            this.hideTabInsertPreview();
            this.previewState = null;
        }
    }

    private onTabBarDrop(event: DragEvent, group: TabGroup): void {
        const payload = this.getDragPayload(event);
        if (!payload) {
            return;
        }
        event.preventDefault();
        const insertionIndex = this.previewState?.index ?? group.size();
        this.hideTabInsertPreview();
        this.previewState = null;

        if (payload.containerId === this.id) {
            this.moveTabWithinContainer(payload, group, insertionIndex);
            if (this.dragState) {
                this.dragState.handled = true;
            }
        } else if (this.windowManager) {
            this.windowManager.moveWindowBetweenContainers(payload, this, group.id, insertionIndex);
        }
    }

    private moveTabWithinContainer(payload: TabDragPayload, targetGroup: TabGroup, insertionIndex: number): void {
        const sourceInfo = this.tabs.get(payload.tabId);
        if (!sourceInfo) {
            return;
        }
        const sourceGroup = this.groups.get(sourceInfo.groupId);
        if (!sourceGroup) {
            return;
        }

        if (sourceGroup === targetGroup) {
            const currentIndex = sourceGroup.getTabIndexById(payload.tabId);
            sourceGroup.moveTab(currentIndex, insertionIndex);
            this.renderLayout();
            return;
        }

        const tab = sourceGroup.removeTabById(payload.tabId);
        if (!tab) {
            return;
        }
        this.unregisterTab(payload.tabId);
        this.registerTab(tab, targetGroup);
        targetGroup.addTab(tab, insertionIndex);
        targetGroup.setActiveIndex(targetGroup.getTabIndexById(tab.id));
        this.pruneEmptyStructure();
        this.renderLayout();
    }

    private getDragPayload(event: DragEvent): TabDragPayload | null {
        if (!event.dataTransfer) {
            return null;
        }
        const data = event.dataTransfer.getData(WINDOW_TAB_MIME);
        if (!data) {
            return null;
        }
        try {
            return JSON.parse(data) as TabDragPayload;
        } catch {
            return null;
        }
    }

    private computeInsertIndex(tabBar: HTMLElement, clientX: number): number {
        const tabs = Array.from(tabBar.querySelectorAll('[data-tab-id]')) as HTMLElement[];
        for (let i = 0; i < tabs.length; i++) {
            const rect = tabs[i].getBoundingClientRect();
            if (clientX < rect.left + rect.width / 2) {
                return i;
            }
        }
        return tabs.length;
    }

    private showTabInsertPreview(tabBar: HTMLElement, index: number): void {
        if (!this.tabInsertPreview) {
            this.tabInsertPreview = document.createElement('div');
            this.tabInsertPreview.className = 'window-tab-insert-preview';
        }
        if (!tabBar.contains(this.tabInsertPreview)) {
            tabBar.appendChild(this.tabInsertPreview);
        }
        const tabs = Array.from(tabBar.querySelectorAll('[data-tab-id]')) as HTMLElement[];
        let left = 0;
        if (index <= 0) {
            left = 0;
        } else if (index >= tabs.length) {
            left = tabs.length > 0 ? tabs[tabs.length - 1].offsetLeft + tabs[tabs.length - 1].offsetWidth : 0;
        } else {
            left = tabs[index].offsetLeft;
        }
        this.tabInsertPreview.style.left = `${left}px`;
        this.tabInsertPreview.style.height = `${tabBar.clientHeight}px`;
    }

    private hideTabInsertPreview(): void {
        if (this.tabInsertPreview && this.tabInsertPreview.parentElement) {
            this.tabInsertPreview.parentElement.removeChild(this.tabInsertPreview);
        }
    }

    private registerGroup(group: TabGroup): void {
        this.groups.set(group.id, group);
    }

    private unregisterGroup(groupId: string): void {
        this.groups.delete(groupId);
    }

    private registerTab(tab: Tab, group: TabGroup): void {
        this.tabs.set(tab.id, { tab, groupId: group.id });
    }

    private unregisterTab(tabId: string): void {
        this.tabs.delete(tabId);
    }

    private pruneEmptyStructure(): void {
        const pruned = this.removeEmptyLeaves(this.rootNode);
        if (!pruned) {
            const placeholderGroup = new TabGroup();
            this.registerGroup(placeholderGroup);
            this.rootNode = createLeafNode(placeholderGroup, this.minWidth, this.minHeight);
        } else {
            this.rootNode = pruned;
        }
    }

    private removeEmptyLeaves(node: LayoutNode): LayoutNode | null {
        if (node.type === 'leaf') {
            if (node.group.size() === 0) {
                this.unregisterGroup(node.group.id);
                return null;
            }
            return node;
        }

        const first = this.removeEmptyLeaves(node.first);
        const second = this.removeEmptyLeaves(node.second);

        if (!first && !second) {
            return null;
        }
        if (!first) {
            return second!;
        }
        if (!second) {
            return first!;
        }
        node.first = first;
        node.second = second;
        return node;
    }

    public split(direction: SplitDirection, window: Window): void {
        if (this.rootNode.type === 'leaf') {
            const currentGroup = this.rootNode.group;
            const newGroup = new TabGroup([new Tab(window)]);
            this.registerGroup(newGroup);
            const firstNode = createLeafNode(currentGroup, this.minWidth, this.minHeight);
            const secondNode = createLeafNode(newGroup, this.minWidth, this.minHeight);
            this.rootNode = createSplitNode(direction, firstNode, secondNode, 0.5);
            const insertedTab = newGroup.getTabs()[0];
            this.registerTab(insertedTab, newGroup);
            this.renderLayout();
        } else {
            // TODO: implement recursive split logic when non-leaf node
        }
    }

    public isEmpty(): boolean {
        for (const group of this.groups.values()) {
            if (group.size() > 0) {
                return false;
            }
        }
        return true;
    }
}

