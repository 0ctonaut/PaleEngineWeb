import { Command } from './command';

export class CommandManager {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  execute(command: Command): void {
    // Remove any commands after current index (when branching from history)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    command.execute();
    
    this.history.push(command);
    this.currentIndex++;
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): void {
    if (!this.canUndo()) return;
    
    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;
  }

  redo(): void {
    if (!this.canRedo()) return;
    
    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  getHistorySize(): number {
    return this.history.length;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);
    
    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(removeCount);
      this.currentIndex = Math.max(-1, this.currentIndex - removeCount);
    }
  }
}
