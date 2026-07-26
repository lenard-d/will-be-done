import { selectSync } from "@will-be-done/hyperdb";
import {
  dailyListByDate,
  dailyListTasksByState,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
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
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  const db = getHyperDB(spaceDBConfig(spaceId)).db;
  const dailyList = selectSync(db, {
    selector: dailyListByDate,
    args: { date },
  });
  if (!dailyList) return [];

  return selectSync(db, {
    selector: dailyListTasksByState,
    args: { dailyListId: dailyList.id, state },
  }).map(toPublicTask);
}
