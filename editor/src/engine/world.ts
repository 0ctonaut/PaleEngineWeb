/// <reference types="vite/client" />
import {
    createCamera,
    createRenderer,
    createCube,
    createGlassSphere,
    createMirrorSphere,
    SelectionCategory,
    Layers,
    PaleScene,
    PaleObject
} from '@paleengine/core';
import {
    WebGPURenderer,
    Scene,
    Color,
    EquirectangularReflectionMapping,
} from 'three/webgpu';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
    PassManager,
    SceneRenderPass,
    Renderer,
    InfiniteGridHelper,
} from './rendering';
import { ModeManager, EditorMode, RendererState } from './mode-manager';
import { EventEmitter, WorldEventMap } from './events';

export class PaleWorld {
    private readonly _paleScene: PaleScene;

    private _isDisposed: boolean = false;
    private _isActive: boolean = false;
    private _selectedObjects: Set<PaleObject> = new Set();

    private readonly _eventEmitter: EventEmitter<WorldEventMap>;

    private _modeManager!: ModeManager;

    private _passManager!: PassManager;
    private _sceneRenderPass!: SceneRenderPass;

    public constructor() {
        this._paleScene = new PaleScene();
        this._eventEmitter = new EventEmitter<WorldEventMap>();

        this._paleScene.on('hierarchychange', (event) => {
            this._eventEmitter.emit('hierarchychange', {
                scene: this._paleScene.getThreeScene(),
                ...event
            });
        });

        const sceneCamera = createCamera(60, 1, 0.1, 5000, [0, 0, 10]);
        const sceneRenderer = createRenderer();
        const gameCamera = createCamera(60, 1, 0.1, 5000, [0, 0, 10]);
        const gameRenderer = createRenderer();
        const sceneState: RendererState = { camera: sceneCamera, renderer: sceneRenderer };
        const gameState: RendererState = { camera: gameCamera, renderer: gameRenderer };

        this._modeManager = new ModeManager(sceneState, gameState, this._paleScene);

        this._modeManager.onModeChange((event) => {
            if (event.currentMode === EditorMode.Scene) {
                const savedSelected = this._modeManager.getSavedSelectedObjects();
                for (const obj of savedSelected) {
                    this.selectObject(obj);
                }
            }
        });

        this._initializePassSystem();
        this._initializeScene();
        this._loadSkybox();
    }

    public async animate(): Promise<void> {
        if (this._isDisposed) {
            return;
        }

        if (this._isActive) {
            this._render();
        }

        if (!this._isDisposed) {
            requestAnimationFrame(() => this.animate());
        }
    }

    public startRendering(): void {
        this._isActive = true;
    }

    public stopRendering(): void {
        this._isActive = false;
    }

    public dispose(): void {
        this._isDisposed = true;
        if (this._passManager) {
            this._passManager.dispose();
        }

        this._modeManager.getSceneState().renderer.dispose();
        this._modeManager.getGameState().renderer.dispose();

        this._paleScene.clear();
    }

    public addObject(object: PaleObject): void {
        this._paleScene.add(object);
    }

    public removeObject(object: PaleObject): void {
        this._selectedObjects.delete(object);
        this._paleScene.remove(object);
    }

    private _initializeScene(): void {
        this._modeManager.getSceneState().camera.layers.enableAll();

        const mirrorCube = createMirrorSphere();
        mirrorCube.position.set(-2, 0, 0);
        mirrorCube.name = 'Example-Cube';
        this.addObject(mirrorCube);

        const glassSphere = createGlassSphere();
        glassSphere.position.set(2, 0, 0);
        glassSphere.name = 'Example-Glass-Ball';
        this.addObject(glassSphere);

        const floor = createCube([10, 1, 10], 'gray');
        floor.position.set(0, -2, 0);
        floor.name = 'Example-Floor';
        this.addObject(floor);
    }

    private async _render(): Promise<void> {
        const targetCamera = this._modeManager.getCurrentCamera();

        const renderer = new Renderer(this._modeManager.getCurrentRenderer());
        await this._passManager.render(renderer, this._paleScene.getThreeScene(), targetCamera);
    }

    private async _loadSkybox(): Promise<void> {
        const scene = this._paleScene.getThreeScene();
        try {
            console.log('Loading HDR skybox...');

            const hdrLoader = new HDRLoader();
            const baseUrl = import.meta.env.BASE_URL;
            const texture = await hdrLoader.loadAsync(`${baseUrl}assets/skyboxes/qwantani_moon_noon_puresky_1k.hdr`.replace(/\/+/g, '/'));
            texture.mapping = EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
            console.log('Skybox applied to scene');
        } catch (error) {
            console.error('Failed to load HDR skybox:', error);
            scene.background = new Color(0x87CEEB);
        }
    }

    private _initializePassSystem(): void {
        this._passManager = new PassManager();

        const grid = new InfiniteGridHelper(0.1, 1, 0x444444, this._modeManager.getSceneState().camera.far);
        grid.layers.set(Layers.UI);
        const paleObject = new PaleObject(grid, 'Grid');
        paleObject.tag = SelectionCategory.UI_HELPER;
        this.addObject(paleObject);

        this._sceneRenderPass = new SceneRenderPass(this._paleScene.getThreeScene(), this._modeManager.getSceneState().camera, true);

        this._passManager.addPass('scene', this._sceneRenderPass);
    }

    public updateSize(width: number, height: number): void {
        const sceneState = this._modeManager.getSceneState();
        const gameState = this._modeManager.getGameState();

        sceneState.renderer.setSize(width, height);
        sceneState.renderer.setPixelRatio(window.devicePixelRatio);
        sceneState.camera.aspect = width / height;
        sceneState.camera.updateProjectionMatrix();

        gameState.renderer.setSize(width, height);
        gameState.renderer.setPixelRatio(window.devicePixelRatio);
        gameState.camera.aspect = width / height;
        gameState.camera.updateProjectionMatrix();

        if (this._passManager) {
            this._passManager.setSize(width, height);
        }
    }

    public get scene(): Scene {
        return this._paleScene.getThreeScene();
    }

    public get paleScene(): PaleScene {
        return this._paleScene;
    }

    public get modeManager(): ModeManager {
        return this._modeManager;
    }

    public get renderer(): WebGPURenderer {
        return this._modeManager.getSceneState().renderer;
    }

    public get selectedObjects(): Set<PaleObject> {
        return this._selectedObjects;
    }

    public enterGameMode(): void {
        this.clearSelection();
        this._modeManager.enterGameMode();
    }

    public enterSceneMode(): void {
        this._modeManager.enterSceneMode();
    }

    public selectObject(object: PaleObject): void {
        this._selectedObjects.add(object);
        this._emitSelectionChange();
    }

    public deselectObject(object: PaleObject): void {
        if (this._selectedObjects.delete(object)) {
            this._emitSelectionChange();
        }
    }

    public toggleSelection(object: PaleObject): void {
        if (this._selectedObjects.has(object)) {
            this._selectedObjects.delete(object);
        } else {
            this._selectedObjects.add(object);
        }
        this._emitSelectionChange();
    }

    public clearSelection(): void {
        this._selectedObjects.clear();
        this._emitSelectionChange();
    }

    public on<K extends keyof WorldEventMap>(type: K, listener: (event: WorldEventMap[K]) => void): () => void {
        return this._eventEmitter.on(type, listener);
    }

    public off<K extends keyof WorldEventMap>(type: K, listener: (event: WorldEventMap[K]) => void): void {
        this._eventEmitter.off(type, listener);
    }

    private _emit<K extends keyof WorldEventMap>(type: K, event: WorldEventMap[K]): void {
        this._eventEmitter.emit(type, event);
    }

    public requestHierarchyRefresh(): void {
        this._eventEmitter.emit('hierarchychange', {
            scene: this._paleScene.getThreeScene(),
            type: 'refresh',
            objects: [],
            parent: null
        });
    }

    private _emitSelectionChange(): void {
        this._emit('selectionchange', { selected: this._selectedObjects });
    }
}