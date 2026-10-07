import { describe, expect, it } from "vitest";
import { DB, execSync, selectSync, syncDispatch } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { defaultTask, taskById } from "./tasks";
import { dailyEntriesTable, tasksTable } from "./tables";
import {
  dailyEntriesByDailyListId,
  dailyEntryById,
  reorderDailyEntry,
} from "./dailyEntries";

function createDB({
  stateOfA = "todo",
  stateOfB = "todo",
}: {
  stateOfA?: "todo" | "done";
  stateOfB?: "todo" | "done";
} = {}) {
  const db = new DB(new BptreeInmemDriver());
  execSync(db.loadTables([tasksTable, dailyEntriesTable]));
  execSync(
    db.driver.insert("tasks", [
      {
        ...defaultTask,
        id: "A",
        projectSectionId: "project-a-section",
        title: "A",
        state: stateOfA,
        orderToken: "a0",
      },
      {
        ...defaultTask,
        id: "hidden",
        projectSectionId: "project-b-section",
        title: "Hidden",
        orderToken: "a0",
      },
      {
        ...defaultTask,
        id: "B",
        projectSectionId: "project-a-section",
        title: "B",
        state: stateOfB,
        orderToken: "a1",
      },
      {
        ...defaultTask,
        id: "Tuesday",
        projectSectionId: "project-a-section",
        title: "Tuesday",
        orderToken: "a2",
      },
    ]),
  );
  execSync(
    db.driver.insert(dailyEntriesTable.tableName, [
      {
        id: "A",
        type: "dailyEntry",
        dailyListId: "Monday",
        orderToken: "a0",
        createdAt: 0,
      },
      {
        id: "hidden",
        type: "dailyEntry",
        dailyListId: "Monday",
        orderToken: "a1",
        createdAt: 0,
      },
      {
        id: "B",
        type: "dailyEntry",
        dailyListId: "Monday",
        orderToken: "a2",
        createdAt: 0,
      },
      {
        id: "Tuesday",
        type: "dailyEntry",
        dailyListId: "Tuesday",
        orderToken: "a0",
        createdAt: 0,
      },
    ]),
  );
  return db;
}

function reorder(db: DB) {
  syncDispatch(
    db,
    reorderDailyEntry({ taskId: "B", targetTaskId: "A", edge: "top" }),
  );
}

describe("persistent daily order", () => {
  it("keeps todo and completed tasks separate during reorder", () => {
    const db = createDB({ stateOfB: "done" });
    const before = selectSync(db, {
      selector: dailyEntryById,
      args: { id: "B" },
    });
    reorder(db);
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "B" } }),
    ).toEqual(before);
  });

  it("uses the saved day order for completed tasks too", () => {
    const db = createDB({ stateOfA: "done", stateOfB: "done" });
    reorder(db);
    const entries = selectSync(db, {
      selector: dailyEntriesByDailyListId,
      args: { dailyListId: "Monday" },
    });
    expect(entries.map((entry) => entry.id)).toEqual(["B", "A", "hidden"]);
  });
  it("reorders a filtered project subsequence using the full saved day order", () => {
    const db = createDB();
    reorder(db);
    const entries = selectSync(db, {
      selector: dailyEntriesByDailyListId,
      args: { dailyListId: "Monday" },
    });
    expect(entries.map((entry) => entry.id)).toEqual(["B", "A", "hidden"]);
  });

  it("preserves project membership and project manual order", () => {
    const db = createDB();
    const before = selectSync(db, { selector: taskById, args: { id: "B" } });
    reorder(db);
    expect(selectSync(db, { selector: taskById, args: { id: "B" } })).toEqual(
      before,
    );
  });

  it("does not change planned dates for cross-day reorder requests", () => {
    const db = createDB();
    const before = selectSync(db, {
      selector: dailyEntryById,
      args: { id: "Tuesday" },
    });
    syncDispatch(
      db,
      reorderDailyEntry({ taskId: "Tuesday", targetTaskId: "A", edge: "top" }),
    );
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "Tuesday" } }),
    ).toEqual(before);
  });

  it("does not create a schedule for an unscheduled task", () => {
    const db = createDB();
    syncDispatch(
      db,
      reorderDailyEntry({
        taskId: "unscheduled",
        targetTaskId: "A",
        edge: "top",
      }),
    );
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "unscheduled" } }),
    ).toBeUndefined();
  });
});
