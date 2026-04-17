import type { Engine, Camera } from 'babylonjs';
import type { PaleObject, PaleScene } from '@paleengine/core';

export enum EditorMode {
    Scene = 'scene',
    Game = 'game'
}

export interface ModeChangeEvent {
    previousMode: EditorMode;
    currentMode: EditorMode;
}

export interface RendererState {
    camera: Camera;
    engine: Engine;
}

export class ModeManager {
    private readonly _sceneState: RendererState;
    private readonly _gameState: RendererState;
    private _currentMode: EditorMode = EditorMode.Scene;
    private readonly _listeners: Set<(event: ModeChangeEvent) => void> = new Set();

    private _savedState: {
        selectedObjects: Set<PaleObject>;
        cameraPosition?: { x: number; y: number; z: number };
        cameraRotation?: { x: number; y: number; z: number };
    } | null = null;

    public constructor(sceneState: RendererState, gameState: RendererState, _paleScene: PaleScene) {
        this._sceneState = sceneState;
        this._gameState = gameState;
    }

    public getCurrentMode(): EditorMode {
        return this._currentMode;
    }

    public getCurrentCamera(): Camera {
        return this._currentMode === EditorMode.Scene
            ? this._sceneState.camera
            : this._gameState.camera;
    }

    public getCurrentRenderer(): Engine {
        return this._currentMode === EditorMode.Scene
            ? this._sceneState.engine
            : this._gameState.engine;
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

        const sceneCamera = this._sceneState.camera as any;

        this._savedState = {
            selectedObjects: new Set(),
            cameraPosition: sceneCamera.position ? {
                x: sceneCamera.position.x,
                y: sceneCamera.position.y,
                z: sceneCamera.position.z
            } : undefined,
            cameraRotation: sceneCamera.rotation ? {
                x: sceneCamera.rotation.x,
                y: sceneCamera.rotation.y,
                z: sceneCamera.rotation.z
            } : undefined
        };

        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public enterSceneMode(): void {
        if (this._currentMode === EditorMode.Scene) {
            return;
        }

        const previousMode = this._currentMode;
        this._currentMode = EditorMode.Scene;

        if (this._savedState) {
            const sceneCamera = this._sceneState.camera as any;
            if (sceneCamera.position && this._savedState.cameraPosition) {
                sceneCamera.position.x = this._savedState.cameraPosition.x;
                sceneCamera.position.y = this._savedState.cameraPosition.y;
                sceneCamera.position.z = this._savedState.cameraPosition.z;
            }
            if (sceneCamera.rotation && this._savedState.cameraRotation) {
                sceneCamera.rotation.x = this._savedState.cameraRotation.x;
                sceneCamera.rotation.y = this._savedState.cameraRotation.y;
                sceneCamera.rotation.z = this._savedState.cameraRotation.z;
            }
        }

        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public onModeChange(listener: (event: ModeChangeEvent) => void): () => void {
        this._listeners.add(listener);
        return () => {
            this._listeners.delete(listener);
        };
    }

    private _emitModeChange(event: ModeChangeEvent): void {
        for (const listener of this._listeners) {
            listener(event);
        }
    }

    public getSavedSelectedObjects(): Set<PaleObject> {
        return this._savedState?.selectedObjects ?? new Set();
    }

    public saveSelectedObjects(objects: Set<PaleObject>): void {
        if (this._savedState) {
            this._savedState.selectedObjects = objects;
        }
    }
}