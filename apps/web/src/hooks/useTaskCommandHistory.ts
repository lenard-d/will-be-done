import { useCallback } from "react";
import { selectAsync } from "@will-be-done/hyperdb";
import { useAsyncDispatch, useDB } from "@will-be-done/hyperdb/react";
import {
  taskUndoSnapshot,
  undoTaskCommand as undoTaskMutation,
} from "@will-be-done/slices/space";
import { TaskCommandHistory } from "@/store/taskCommandHistory";

const histories = new WeakMap<object, TaskCommandHistory>();

function historyFor(db: object): TaskCommandHistory {
  const existing = histories.get(db);
  if (existing) return existing;

  const history = new TaskCommandHistory();
  histories.set(db, history);
  return history;
}

export function useTaskCommandHistory() {
  const db = useDB();
  const dispatch = useAsyncDispatch();
  const history = historyFor(db);

  const executeTaskCommand = useCallback(
    (taskIds: string[], mutation: () => Promise<unknown>) =>
      history.execute(async () => {
        const snapshot = await selectAsync(db, {
          selector: taskUndoSnapshot,
          args: { ids: taskIds },
        });
        if (snapshot.tasks.length === 0) return undefined;

        await mutation();
        const after = await selectAsync(db, {
          selector: taskUndoSnapshot,
          args: { ids: taskIds },
        });
        return async () => {
          await dispatch(undoTaskMutation({ before: snapshot, after }));
        };
      }),
    [db, dispatch, history],
  );

  const undoTaskCommand = useCallback(() => history.undo(), [history]);

  return { executeTaskCommand, undoTaskCommand };
}
