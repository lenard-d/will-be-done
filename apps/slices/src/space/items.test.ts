import { describe, expect, it } from "vitest";
import { DB, execSync, selectSync, syncDispatch } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { createTaskNextToListItem, createTaskNextToPlannedItem } from "./items";
import { dailyEntriesByDailyListId, dailyEntryById } from "./dailyEntries";
import { defaultTask, taskById } from "./tasks";
import { defaultTaskTemplate } from "./taskTemplates";
import { dailyEntriesTable, tasksTable, taskTemplatesTable } from "./tables";

function createDB() {
  const db = new DB(new BptreeInmemDriver());
  execSync(db.loadTables([tasksTable, taskTemplatesTable, dailyEntriesTable]));
  execSync(
    db.driver.insert(tasksTable.tableName, [
      { ...defaultTask, id: "selected", orderToken: "a0" },
      { ...defaultTask, id: "neighbor", orderToken: "a1" },
      { ...defaultTask, id: "unscheduled", orderToken: "a2" },
    ]),
  );
  execSync(
    db.driver.insert(dailyEntriesTable.tableName, [
      {
        id: "selected",
        type: "dailyEntry",
        dailyListId: "2026-10-08",
        orderToken: "a0",
        createdAt: 0,
      },
      {
        id: "neighbor",
        type: "dailyEntry",
        dailyListId: "2026-10-08",
        orderToken: "a1",
        createdAt: 0,
      },
    ]),
  );
  return db;
}

describe("planned task insertion", () => {
  it.each(["before", "after"] as const)(
    "inherits the selected task's saved day and inserts %s it",
    (position) => {
      const db = createDB();
      const selected = selectSync(db, {
        selector: taskById,
        args: { id: "selected" },
      });
      if (!selected) throw new Error("Missing selected test task");
      syncDispatch(
        db,
        createTaskNextToPlannedItem({
          listItem: selected,
          position,
          taskParams: { id: "new-task" },
        }),
      );
      expect(
        selectSync(db, {
          selector: dailyEntriesByDailyListId,
          args: { dailyListId: "2026-10-08" },
        }).map((entry) => entry.id),
      ).toEqual(
        position === "before"
          ? ["new-task", "selected", "neighbor"]
          : ["selected", "new-task", "neighbor"],
      );
    },
  );

  it("keeps a sibling unscheduled when its selected task is unscheduled", () => {
    const db = createDB();
    syncDispatch(
      db,
      createTaskNextToPlannedItem({
        listItem: { ...defaultTask, id: "unscheduled" },
        position: "after",
        taskParams: { id: "new-task" },
      }),
    );
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "new-task" } }),
    ).toBeUndefined();
  });

  it("keeps the existing unscheduled project behavior in other sort modes", () => {
    const db = createDB();
    syncDispatch(
      db,
      createTaskNextToListItem({
        listItem: { ...defaultTask, id: "selected" },
        position: "after",
        taskParams: { id: "new-task" },
      }),
    );
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "new-task" } }),
    ).toBeUndefined();
  });

  it("creates an unscheduled task next to a repeat template", () => {
    const db = createDB();
    const template = {
      ...defaultTaskTemplate,
      id: "template",
      orderToken: "a3",
    };
    execSync(db.driver.insert(taskTemplatesTable.tableName, [template]));
    syncDispatch(
      db,
      createTaskNextToPlannedItem({
        listItem: template,
        position: "before",
        taskParams: { id: "new-task" },
      }),
    );
    expect(
      selectSync(db, { selector: dailyEntryById, args: { id: "new-task" } }),
    ).toBeUndefined();
  });
});
