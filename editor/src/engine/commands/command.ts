// Base command interface for undo/redo system
export interface Command {
  execute(): void;
  undo(): void;
}
