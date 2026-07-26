import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  dailyListByDate,
  dailyEntryByTaskId,
  dailyEntrySiblings,
  removeFromDailyList,
  scheduleTask as scheduleTaskAction,
  taskById,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
import { ResourceNotFoundError } from "./errors";
import { resolveCreatePosition, type Placement } from "./placement";
import { toPublicTask, type PublicTask } from "./tasks";

export interface ScheduledTaskResponse {
  task: PublicTask;
  date: string;
}

export function scheduleTask({
  spaceId,
  taskId,
  userId,
  date,
  placement = { kind: "last" },
}: {
  spaceId: string;
  taskId: string;
  userId: string;
  date: string;
  placement?: Placement;
}): ScheduledTaskResponse {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  const db = getHyperDB(spaceDBConfig(spaceId)).db;
  const task = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!task) throw new ResourceNotFoundError("Task");

  const dailyList = selectSync(db, {
    selector: dailyListByDate,
    args: { date },
  });
  let position: ReturnType<typeof resolveCreatePosition>;
  if (placement.kind === "before" || placement.kind === "after") {
    const anchor = selectSync(db, {
      selector: dailyEntryByTaskId,
      args: { taskId: placement.anchorId },
    });
    if (!dailyList || !anchor || anchor.dailyListId !== dailyList.id) {
      position = resolveCreatePosition({ entities: [], placement });
    } else {
      const [before, after] = selectSync(db, {
        selector: dailyEntrySiblings,
        args: { taskId: anchor.id },
      });
      position =
        placement.kind === "before"
          ? [before ?? null, anchor]
          : [anchor, after ?? null];
    }
  } else {
    position = resolveCreatePosition({ entities: [], placement });
  }

  syncDispatch(
    db,
    scheduleTaskAction({
      taskId,
      date,
      position,
    }),
  );

  return { task: toPublicTask(db, task), date };
}

export function clearTaskSchedule({
  spaceId,
  taskId,
  userId,
}: {
  spaceId: string;
  taskId: string;
  userId: string;
}): void {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  const db = getHyperDB(spaceDBConfig(spaceId)).db;
  const task = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!task) throw new ResourceNotFoundError("Task");

  syncDispatch(db, removeFromDailyList({ taskId }));
}
