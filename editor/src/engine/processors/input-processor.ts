import { World } from '../world';
import { LocalInputManager } from '../input';

export abstract class InputProcessor {
    protected world: World;
    protected inputManager: LocalInputManager;
    protected enabled: boolean = true;

    constructor(world: World, inputManager: LocalInputManager) {
        this.world = world;
        this.inputManager = inputManager;
        this.setupInputHandlers();
    }

    protected abstract setupInputHandlers(): void;
    public abstract update(deltaTime: number): void;
    public abstract dispose(): void;

    public enable(): void {
        this.enabled = true;
    }

    public disable(): void {
        this.enabled = false;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }
}
