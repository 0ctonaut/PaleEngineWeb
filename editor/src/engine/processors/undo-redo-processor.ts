import { InputProcessor } from './input-processor';
import { EventTypes, InputEvent, Keys } from '../input';

export class UndoRedoProcessor extends InputProcessor {
  private boundKeyDownHandler: (event: InputEvent) => void;

  constructor(world: any, inputManager: any) {
    super(world, inputManager);
    
    // Bind event handlers
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);
    
    this.setupInputHandlers();
  }

  protected setupInputHandlers(): void {
    // Listen for keyboard shortcuts
    this.inputManager.on(EventTypes.KEY_DOWN, this.boundKeyDownHandler);
  }

  private handleKeyDown(event: InputEvent): void {
    if (!this.enabled) return;

    const keyboardEvent = event.originalEvent as KeyboardEvent;
    const code = keyboardEvent.code;
    const commandManager = this.world.getCommandManager();

    // Ctrl+Z: Undo
    if (code === Keys.Z && keyboardEvent.ctrlKey && !keyboardEvent.shiftKey) {
      if (commandManager.canUndo()) {
        commandManager.undo();
        event.preventDefault();
      }
    }
    
    // Ctrl+Shift+Z: Redo
    if (code === Keys.Z && keyboardEvent.ctrlKey && keyboardEvent.shiftKey) {
      if (commandManager.canRedo()) {
        commandManager.redo();
        event.preventDefault();
      }
    }
  }

  public update(_deltaTime: number): void {
    // Undo/Redo processor doesn't need per-frame updates
  }

  public dispose(): void {
    this.inputManager.off(EventTypes.KEY_DOWN, this.boundKeyDownHandler);
  }
}

