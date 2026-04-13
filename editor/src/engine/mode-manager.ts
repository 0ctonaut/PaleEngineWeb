export enum EditorMode {
    Scene = 'scene',  // 编辑模式
    Game = 'game'     // 游戏模式
}

export interface ModeChangeEvent {
    previousMode: EditorMode;
    currentMode: EditorMode;
}

export class ModeManager {
    private _currentMode: EditorMode = EditorMode.Scene;
    private readonly _listeners: Set<(event: ModeChangeEvent) => void> = new Set();
    
    // 状态保存
    private _savedState: {
        selectedObject: any;
        cameraPosition?: { x: number; y: number; z: number };
        cameraRotation?: { x: number; y: number; z: number };
        [key: string]: any;
    } | null = null;

    public getCurrentMode(): EditorMode {
        return this._currentMode;
    }

    public enterGameMode(): void {
        if (this._currentMode === EditorMode.Game) {
            return;
        }

        const previousMode = this._currentMode;
        this._currentMode = EditorMode.Game;
        
        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public enterSceneMode(): void {
        if (this._currentMode === EditorMode.Scene) {
            return;
        }

        const previousMode = this._currentMode;
        this._currentMode = EditorMode.Scene;
        
        this._emitModeChange({ previousMode, currentMode: this._currentMode });
    }

    public saveState(state: any): void {
        this._savedState = { ...state };
    }

    public restoreState(): any | null {
        return this._savedState;
    }

    public clearSavedState(): void {
        this._savedState = null;
    }

    public onModeChange(listener: (event: ModeChangeEvent) => void): void {
        this._listeners.add(listener);
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


