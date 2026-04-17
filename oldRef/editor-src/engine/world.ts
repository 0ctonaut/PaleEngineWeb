/// <reference types="vite/client" />
import { Engine, WebGPUEngine } from 'babylonjs';
import {
    createRenderer,
    createCube,
    createGlassSphere,
    createMirrorSphere,
    PaleScene,
    PaleObject
} from '@paleengine/core';
import {
    PassManager,
    SceneRenderPass,
    InfiniteGridHelper,
} from './rendering';
import { ModeManager, EditorMode, RendererState } from './mode-manager';
import { EventEmitter, WorldEventMap } from './events';

export class PaleWorld {
    private readonly _engine: WebGPUEngine;
    private readonly _paleScene: PaleScene;

    private _isDisposed: boolean = false;
    private _isActive: boolean = false;
    private _selectedObjects: Set<PaleObject> = new Set();

    private readonly _eventEmitter: EventEmitter<WorldEventMap>;

    private _modeManager!: ModeManager;

    private _passManager!: PassManager;

    public constructor(canvas: HTMLCanvasElement) {
        this._engine = createRenderer(canvas) as unknown as WebGPUEngine;

        this._paleScene = new PaleScene(this._engine);

        this._eventEmitter = new EventEmitter<WorldEventMap>();

        this._paleScene.on('hierarchychange', (event) => {
            this._eventEmitter.emit('hierarchychange', {
                scene: this._paleScene.getBabylonScene(),
                ...event
            });
        });

        const sceneCamera = this._paleScene.getBabylonScene().activeCamera!;
        const sceneState: RendererState = { camera: sceneCamera, engine: this._engine };
        const gameState: RendererState = { camera: sceneCamera, engine: this._engine };

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
        this._engine.runRenderLoop(() => {
            if (this._isActive) {
                this._render();
            }
        });
    }

    public stopRendering(): void {
        this._isActive = false;
        this._engine.stopRenderLoop();
    }

    public dispose(): void {
        this._isDisposed = true;
        if (this._passManager) {
            this._passManager.dispose();
        }

        this._paleScene.clear();
        this._engine.dispose();
    }

    public addObject(object: PaleObject): void {
        this._paleScene.add(object);
    }

    public removeObject(object: PaleObject): void {
        this._selectedObjects.delete(object);
        this._paleScene.remove(object);
    }

    private _initializePassSystem(): void {
        this._passManager = new PassManager();

        const sceneCamera = this._paleScene.getBabylonScene().activeCamera;
        if (sceneCamera) {
            const scenePass = new SceneRenderPass(this._paleScene.getBabylonScene(), sceneCamera);
            this._passManager.addPass('scene', scenePass);
        }

        const gridHelper = new InfiniteGridHelper(this._paleScene.getBabylonScene());
        this._passManager.addPass('grid', gridHelper as any);
    }

    private _initializeScene(): void {
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

        if (this._passManager) {
            await this._passManager.render(this._engine, this._paleScene.getBabylonScene(), targetCamera);
        } else {
            this._paleScene.getBabylonScene().render();
        }
    }

    public updateSize(width: number, height: number): void {
        this._engine.resize();

        if (this._passManager) {
            this._passManager.setSize(width, height);
        }
    }

    public get scene() {
        return this._paleScene.getBabylonScene();
    }

    public get paleScene(): PaleScene {
        return this._paleScene;
    }

    public get modeManager(): ModeManager {
        return this._modeManager;
    }

    public get engine(): WebGPUEngine {
        return this._engine;
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
            scene: this._paleScene.getBabylonScene(),
            type: 'refresh',
            objects: [],
            parent: null
        });
    }

    private _emitSelectionChange(): void {
        this._emit('selectionchange', { selected: this._selectedObjects });
    }
}