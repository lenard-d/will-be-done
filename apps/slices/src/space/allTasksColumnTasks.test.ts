import { describe, expect, it } from "vitest";
import { DB, execSync, selectSync, syncDispatch } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { dbIdTrait } from "../traits";
import { createTaskInAllTasksColumn } from "./allTasksColumnTasks";
import { createAllTasksColumn } from "./allTasksColumns";
import { createDailyListIfNotPresent } from "./dailyLists";
import {
  addToDailyList,
  dailyEntriesByDailyListId,
  dailyEntryByTaskId,
} from "./dailyEntries";
import { createTaskInSection, inboxProjectSectionId } from "./projectSections";
import { projectSectionItemIds } from "./projectSectionItems";
import { registeredSpaceSyncableTables } from "./syncMap";
import { emptyTaskFilters, type TaskFilters } from "./taskViewFilters";
import {
  allTasksColumnsTable,
  dailyEntriesTable,
  projectSectionsTable,
  tasksTable,
} from "./tables";

function createDB() {
  const db = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait("space", "a0000000-0000-4000-8000-000000000001")],
  });
  execSync(db.loadTables(registeredSpaceSyncableTables));
  execSync(
    db.driver.insert(projectSectionsTable.tableName, [
      {
        type: "projectSection",
        id: "first-section",
        projectId: "project-1",
        title: "First",
        orderToken: "a0",
        createdAt: 0,
      },
      {
        type: "projectSection",
        id: "matching-section",
        projectId: "project-1",
        title: " Next ",
        orderToken: "a1",
        createdAt: 0,
      },
      {
        type: "projectSection",
        id: "other-project",
        projectId: "project-2",
        title: "Next",
        orderToken: "a0",
        createdAt: 0,
      },
    ]),
  );
  return db;
}

function createColumn(db: DB, filters: Partial<TaskFilters>) {
  return syncDispatch(
    db,
    createAllTasksColumn({
      title: "Saved view",
      filtersJson: JSON.stringify({ ...emptyTaskFilters, ...filters }),
    }),
  );
}

function taskRows(db: DB) {
  return execSync(
    db.driver.intervalScan(tasksTable.tableName, "byIds", [{}], {
      order: "asc",
    }),
  );
}

describe("create a task in an All tasks column", () => {
  it("uses the filtered project section and schedules the exact day", () => {
    const db = createDB();
    const column = createColumn(db, {
      projectIds: ["project-1"],
      columnNames: ["NEXT"],
      plannedDay: { kind: "on", date: "2026-10-08" },
    });
    const day = syncDispatch(
      db,
      createDailyListIfNotPresent({ date: "2026-10-08" }),
    );
    const task = syncDispatch(
      db,
      createTaskInAllTasksColumn({ columnId: column.id }),
    );
    const entry = selectSync(db, {
      selector: dailyEntryByTaskId,
      args: { taskId: task.id },
    });
    expect({
      projectSectionId: task.projectSectionId,
      scheduledListId: entry?.dailyListId,
    }).toEqual({
      projectSectionId: "matching-section",
      scheduledListId: day.id,
    });
  });

  it("uses the first section when exactly one project is selected", () => {
    const db = createDB();
    const column = createColumn(db, { projectIds: ["project-1"] });
    const task = syncDispatch(
      db,
      createTaskInAllTasksColumn({ columnId: column.id }),
    );
    expect(task.projectSectionId).toBe("first-section");
  });

  it("prepends in the project section and appends on the selected day", () => {
    const db = createDB();
    const column = createColumn(db, {
      projectIds: ["project-1"],
      plannedDay: { kind: "on", date: "2026-10-08" },
    });
    const existing = syncDispatch(
      db,
      createTaskInSection({
        projectSectionId: "first-section",
        position: "prepend",
      }),
    );
    const day = syncDispatch(
      db,
      createDailyListIfNotPresent({ date: "2026-10-08" }),
    );
    syncDispatch(
      db,
      addToDailyList({
        taskId: existing.id,
        dailyListId: day.id,
        position: "append",
      }),
    );
    const task = syncDispatch(
      db,
      createTaskInAllTasksColumn({ columnId: column.id }),
    );
    expect({
      sectionIds: selectSync(db, {
        selector: projectSectionItemIds,
        args: { projectSectionId: "first-section" },
      }),
      dailyIds: selectSync(db, {
        selector: dailyEntriesByDailyListId,
        args: { dailyListId: day.id },
      }).map((entry) => entry.id),
    }).toEqual({
      sectionIds: [task.id, existing.id],
      dailyIds: [existing.id, task.id],
    });
  });

  it.each([
    { projectIds: [] },
    { projectIds: ["project-1", "project-2"] },
    { projectIds: ["project-1"], columnNames: ["missing"] },
    { projectIds: ["deleted-project"] },
  ])(
    "falls back to Inbox for an ambiguous or missing target: %s",
    (filters) => {
      const db = createDB();
      const column = createColumn(db, filters);
      const task = syncDispatch(
        db,
        createTaskInAllTasksColumn({ columnId: column.id }),
      );
      expect(task.projectSectionId).toBe(
        selectSync(db, { selector: inboxProjectSectionId, args: {} }),
      );
    },
  );

  it.each([
    { kind: "all" },
    { kind: "scheduled" },
    { kind: "unscheduled" },
    { kind: "range", from: "2026-10-01", to: "2026-10-31" },
  ] satisfies TaskFilters["plannedDay"][])(
    "leaves tasks unscheduled for non-exact day filters: %s",
    (plannedDay) => {
      const db = createDB();
      const column = createColumn(db, { plannedDay });
      const task = syncDispatch(
        db,
        createTaskInAllTasksColumn({ columnId: column.id }),
      );
      expect(
        selectSync(db, {
          selector: dailyEntryByTaskId,
          args: { taskId: task.id },
        }),
      ).toBeUndefined();
    },
  );

  it("rejects a missing view before creating a task", () => {
    const db = createDB();
    expect(() =>
      syncDispatch(db, createTaskInAllTasksColumn({ columnId: "missing" })),
    ).toThrow("not found");
    expect(taskRows(db)).toEqual([]);
  });

  it("rejects malformed persisted filters before creating a task", () => {
    const db = createDB();
    const column = createColumn(db, {});
    execSync(
      db.driver.upsert(allTasksColumnsTable.tableName, [
        { ...column, filtersJson: "{}" },
      ]),
    );
    expect(() =>
      syncDispatch(db, createTaskInAllTasksColumn({ columnId: column.id })),
    ).toThrow();
    expect(taskRows(db)).toEqual([]);
  });

  it("rolls back task creation when scheduling fails, then retries once", () => {
    const db = createDB();
    const column = createColumn(db, {
      plannedDay: { kind: "on", date: "2026-10-08" },
    });
    const day = syncDispatch(
      db,
      createDailyListIfNotPresent({ date: "2026-10-08" }),
    );
    execSync(
      db.driver.insert(dailyEntriesTable.tableName, [
        {
          type: "dailyEntry",
          id: "legacy-entry",
          dailyListId: day.id,
          orderToken: "invalid-key",
          createdAt: 0,
        },
      ]),
    );
    expect(() =>
      syncDispatch(db, createTaskInAllTasksColumn({ columnId: column.id })),
    ).toThrow();
    expect(taskRows(db)).toEqual([]);
    execSync(db.driver.delete(dailyEntriesTable.tableName, ["legacy-entry"]));
    const task = syncDispatch(
      db,
      createTaskInAllTasksColumn({ columnId: column.id }),
    );
    expect(taskRows(db)).toEqual([task]);
  });
});
