import { selectSync } from "@will-be-done/hyperdb";
import {
  dailyListByDate,
  dailyListTasksByState,
} from "@will-be-done/slices/space";
import { getSpaceDatabase } from "./databaseAccess";
import { toPublicTask, type PublicTask } from "./tasks";

export function listDailyListItems({
  spaceId,
  userId,
  date,
  state = "todo",
}: {
  spaceId: string;
  userId: string;
  date: string;
  state?: "todo" | "done";
}): PublicTask[] {
  const db = getSpaceDatabase(spaceId, userId);
  const dailyList = selectSync(db, {
    selector: dailyListByDate,
    args: { date },
  });
  if (!dailyList) return [];

  return selectSync(db, {
    selector: dailyListTasksByState,
    args: { dailyListId: dailyList.id, state },
  }).map((task) => toPublicTask(db, task, dailyList.date));
}
