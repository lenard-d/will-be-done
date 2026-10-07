import { describe, expect, it } from "vitest";
import {
  DB,
  execSync,
  insert,
  selectSync,
  syncDispatch,
  upsert,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { action } from "../builders";
import { dbIdTrait } from "../traits";
import {
  deleteTasks,
  taskById,
  taskUndoSnapshot,
  undoTaskCommand,
  updateTask,
} from "./tasks";
import {
  checklistItemsTable,
  dailyEntriesTable,
  stashEntriesTable,
  tasksTable,
  type Task,
} from "./tables";

const task: Task = {
  type: "task",
  id: "task-1",
  title: "Original title",
  state: "todo",
  projectSectionId: "section-1",
  orderToken: "a0",
  lastToggledAt: 1,
  nature: "unknown",
  createdAt: 1,
  templateId: null,
  templateDate: null,
};

const seedTaskGraph = action({
  name: "seedTaskUndoGraph",
  args: {},
  handler: function* () {
    yield* insert(tasksTable, [task]);
    yield* insert(checklistItemsTable, [
      {
        type: "checklistItem",
        id: "check-1",
        parentId: task.id,
        parentType: "task",
        orderToken: "a0",
        state: "todo",
        content: "Child",
        createdAt: 1,
        checkedAt: null,
      },
    ]);
    yield* insert(dailyEntriesTable, [
      {
        type: "dailyEntry",
        id: task.id,
        orderToken: "a0",
        dailyListId: "day-1",
        createdAt: 1,
      },
    ]);
    yield* insert(stashEntriesTable, [
      {
        type: "stashEntry",
        id: task.id,
        orderToken: "a0",
        createdAt: 1,
      },
    ]);
  },
});

const changeTaskPosition = action({
  name: "changeTaskPositionForUndoTest",
  args: {},
  handler: function* () {
    yield* upsert(tasksTable, [
      { ...task, projectSectionId: "section-2", orderToken: "z0" },
    ]);
  },
});

const changeDailyEntryOrder = action({
  name: "changeDailyEntryOrderForUndoTest",
  args: {},
  handler: function* () {
    yield* upsert(dailyEntriesTable, [
      {
        type: "dailyEntry",
        id: task.id,
        orderToken: "later-order",
        dailyListId: "day-1",
        createdAt: 1,
      },
    ]);
  },
});

const insertTask = action({
  name: "insertTaskForUndoTest",
  args: {},
  handler: function* () {
    yield* insert(tasksTable, [task]);
  },
});

function createEmptyDB() {
  const db = new DB(new BptreeInmemDriver(), {
    traits: [dbIdTrait("space", "a0000000-0000-4000-8000-000000000001")],
  });
  execSync(
    db.loadTables([
      tasksTable,
      checklistItemsTable,
      dailyEntriesTable,
      stashEntriesTable,
    ]),
  );
  return db;
}

function createDB() {
  const db = createEmptyDB();
  syncDispatch(db, seedTaskGraph({}));
  return db;
}

function snapshot(db: DB) {
  return selectSync(db, {
    selector: taskUndoSnapshot,
    args: { ids: [task.id] },
  });
}

function restoredTask(db: DB) {
  return selectSync(db, { selector: taskById, args: { id: task.id } });
}

describe("task undo snapshots", () => {
  it.each([
    ["title", { title: "Changed title" }],
    ["status", { state: "done" as const, lastToggledAt: 2 }],
  ])("restores a task after a %s change", (_name, patch) => {
    const db = createDB();
    const before = snapshot(db);

    syncDispatch(db, updateTask({ id: task.id, task: patch }));
    const after = snapshot(db);
    syncDispatch(db, undoTaskCommand({ before, after }));

    expect(restoredTask(db)).toEqual(task);
  });

  it("restores section and order after moving a task", () => {
    const db = createDB();
    const before = snapshot(db);

    syncDispatch(db, changeTaskPosition({}));
    const after = snapshot(db);
    syncDispatch(db, undoTaskCommand({ before, after }));

    expect(restoredTask(db)).toEqual(task);
  });

  it("restores a deleted task with checklist and list entries", () => {
    const db = createDB();
    const before = snapshot(db);

    syncDispatch(db, deleteTasks({ ids: [task.id] }));
    const after = snapshot(db);
    syncDispatch(db, undoTaskCommand({ before, after }));

    expect(snapshot(db)).toEqual(before);
  });

  it("reapplies a deletion from reversed snapshots", () => {
    const db = createDB();
    const before = snapshot(db);

    syncDispatch(db, deleteTasks({ ids: [task.id] }));
    const after = snapshot(db);
    syncDispatch(db, undoTaskCommand({ before, after }));
    syncDispatch(db, undoTaskCommand({ before: after, after: before }));

    expect(restoredTask(db)).toBeUndefined();
    expect(snapshot(db)).toEqual(after);
  });

  it("removes a task created by the command", () => {
    const db = createEmptyDB();
    const before = snapshot(db);

    syncDispatch(db, insertTask({}));
    const after = snapshot(db);
    syncDispatch(db, undoTaskCommand({ before, after }));

    expect(restoredTask(db)).toBeUndefined();
  });

  it("does not overwrite a newer list change while undoing a title", () => {
    const db = createDB();
    const before = snapshot(db);
    syncDispatch(
      db,
      updateTask({ id: task.id, task: { title: "Changed title" } }),
    );
    const after = snapshot(db);

    syncDispatch(db, changeDailyEntryOrder({}));
    syncDispatch(db, undoTaskCommand({ before, after }));

    expect(restoredTask(db)?.title).toBe(task.title);
    expect(snapshot(db).dailyEntries[0]?.orderToken).toBe("later-order");
  });
});
