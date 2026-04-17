import { PerspectiveCamera, WebGPURenderer } from 'three/webgpu';
import { PaleObject, PaleScene } from '@paleengine/core';

export enum EditorMode {
    Scene = 'scene',
    Game = 'game'
}

export interface ModeChangeEvent {
    previousMode: EditorMode;
    currentMode: EditorMode;
}

export interface RendererState {
    camera: PerspectiveCamera;
    renderer: WebGPURenderer;
}

export class ModeManager {
    private readonly _sceneState: RendererState;
    private readonly _gameState: RendererState;
    private readonly _paleScene: PaleScene;
    private _currentMode: EditorMode = EditorMode.Scene;
    private readonly _listeners: Set<(event: ModeChangeEvent) => void> = new Set();

    private _savedState: {
        selectedObjects: Set<PaleObject>;
        cameraPosition?: { x: number; y: number; z: number };
        cameraRotation?: { x: number; y: number; z: number };
    } | null = null;

    public constructor(sceneState: RendererState, gameState: RendererState, paleScene: PaleScene) {
        this._sceneState = sceneState;
        this._gameState = gameState;
        this._paleScene = paleScene;
    }

    public getCurrentMode(): EditorMode {
        return this._currentMode;
    }

    public getCurrentCamera(): PerspectiveCamera {
        return this._currentMode === EditorMode.Scene
            ? this._sceneState.camera
            : this._gameState.camera;
    }

    public getCurrentRenderer(): WebGPURenderer {
        return this._currentMode === EditorMode.Scene
            ? this._sceneState.renderer
            : this._gameState.renderer;
    }

    public getSceneState(): RendererState {
        return this._sceneState;
    }

    public getGameState(): RendererState {
        return this._gameState;
    }

    public enterGameMode(): void {
        if (this._currentMode === EditorMode.Game) {
            return;
        }

        const previousMode = this._currentMode;
        this._currentMode = EditorMode.Game;

        this._savedState = {
            selectedObjects: new Set(),
            cameraPosition: {
                x: this._sceneState.camera.position.x,
                y: this._sceneState.camera.position.y,
                z: this._sceneState.camera.position.z
            },
            cameraRotation: {
                x: this._sceneState.camera.rotation.x,
                y: this._sceneState.camera.rotation.y,
                z: this._sceneState.camera.rotation.z
            }
        };

        this._paleScene.reset();

        const objects = this._paleScene.getObjects();
        for (const object of objects) {
            const components = object.getAllComponents();
            for (const component of components) {
                this._paleScene.getComponentManager().registerComponent(component);
            }
            object.traverse((child) => {
                if (child !== object) {
                    const childComponents = child.getAllComponents();
                    for (const component of childComponents) {
                        this._paleScene.getComponentManager().registerComponent(component);
                    }
                }
            });
        }

        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public enterSceneMode(): void {
        if (this._currentMode === EditorMode.Scene) {
            return;
        }

        const previousMode = this._currentMode;
        this._currentMode = EditorMode.Scene;

        if (this._savedState) {
            if (this._savedState.cameraPosition) {
                this._sceneState.camera.position.set(
                    this._savedState.cameraPosition.x,
                    this._savedState.cameraPosition.y,
                    this._savedState.cameraPosition.z
                );
            }
            if (this._savedState.cameraRotation) {
                this._sceneState.camera.rotation.set(
                    this._savedState.cameraRotation.x,
                    this._savedState.cameraRotation.y,
                    this._savedState.cameraRotation.z
                );
            }
        }

        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public getSavedSelectedObjects(): Set<PaleObject> {
        return this._savedState?.selectedObjects ?? new Set();
    }

    public onModeChange(listener: (event: ModeChangeEvent) => void): () => void {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    public offModeChange(listener: (event: ModeChangeEvent) => void): void {
        this._listeners.delete(listener);
    }

    private _emitModeChange(event: ModeChangeEvent): void {
        for (const listener of this._listeners) {
            listener(event);
        }
    }
}