export type UndoTaskCommand = () => Promise<void>;
export type ExecuteTaskCommand = () => Promise<UndoTaskCommand | undefined>;

const DEFAULT_HISTORY_LIMIT = 100;

export class TaskCommandHistory {
  private readonly undoStack: UndoTaskCommand[] = [];
  private queue = Promise.resolve();

  constructor(private readonly limit = DEFAULT_HISTORY_LIMIT) {}

  execute(command: ExecuteTaskCommand): Promise<void> {
    return this.enqueue(async () => {
      const undo = await command();
      if (!undo) return;

      this.undoStack.push(undo);
      if (this.undoStack.length > this.limit) {
        this.undoStack.shift();
      }
    });
  }

  undo(): Promise<void> {
    return this.enqueue(async () => {
      const undo = this.undoStack.pop();
      if (undo) await undo();
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

type UndoShortcut = Pick<
  KeyboardEvent,
  "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

export function shouldHandleTaskUndo(event: UndoShortcut): boolean {
  const noModifiers =
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  return (
    (event.code === "KeyU" && noModifiers) ||
    (event.code === "KeyZ" &&
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.altKey)
  );
}
