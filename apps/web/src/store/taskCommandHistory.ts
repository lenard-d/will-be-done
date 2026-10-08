export type TaskCommand = () => Promise<void>;
export type TaskCommandEntry = {
  undo: TaskCommand;
  redo: TaskCommand;
};
export type ExecuteTaskCommand = () => Promise<TaskCommandEntry | undefined>;

const DEFAULT_HISTORY_LIMIT = 100;

export class TaskCommandHistory {
  private readonly undoStack: TaskCommandEntry[] = [];
  private readonly redoStack: TaskCommandEntry[] = [];
  private queue = Promise.resolve();

  constructor(private readonly limit = DEFAULT_HISTORY_LIMIT) {}

  execute(command: ExecuteTaskCommand): Promise<void> {
    return this.enqueue(async () => {
      const entry = await command();
      if (!entry) return;

      this.pushBounded(this.undoStack, entry);
      this.redoStack.length = 0;
    });
  }

  undo(): Promise<void> {
    return this.enqueue(async () => {
      const entry = this.undoStack.at(-1);
      if (!entry) return;

      await entry.undo();
      this.undoStack.pop();
      this.pushBounded(this.redoStack, entry);
    });
  }

  redo(): Promise<void> {
    return this.enqueue(async () => {
      const entry = this.redoStack.at(-1);
      if (!entry) return;

      await entry.redo();
      this.redoStack.pop();
      this.pushBounded(this.undoStack, entry);
    });
  }

  private pushBounded(stack: TaskCommandEntry[], entry: TaskCommandEntry) {
    stack.push(entry);
    if (stack.length > this.limit) stack.shift();
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

type HistoryShortcut = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
>;

export function shouldHandleTaskUndo(event: HistoryShortcut): boolean {
  const key = event.key.toLowerCase();
  const noModifiers =
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

  return (
    (key === "u" && noModifiers) ||
    (key === "z" &&
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      !event.altKey)
  );
}

export function shouldHandleTaskRedo(event: HistoryShortcut): boolean {
  if (event.altKey) return false;
  const key = event.key.toLowerCase();

  return (
    (key === "r" && event.ctrlKey && !event.shiftKey) ||
    (key === "z" && (event.metaKey || event.ctrlKey) && event.shiftKey)
  );
}
