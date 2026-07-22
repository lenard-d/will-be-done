import { describe, expect, it } from "vitest";
import {
  createAction,
  createSelector,
  DB,
  execSync,
  insert,
  selectFrom,
  selectSync,
  syncDispatch,
} from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { changesTable } from "../common";
import {
  legacyTaskSectionsMigrationTable,
  migrateLegacyTaskSections,
  scheduledTodoTasksMigrationTable,
  taskSectionStorageMigrationTables,
  taskTemplatesMigrationTable,
  tasksMigrationTable,
} from "./taskSectionStorageMigration";
import {
  scheduledTodoTasksTable,
  taskSectionsTable,
  taskTemplatesTable,
  tasksTable,
} from "./tables";

const action = createAction();
const selector = createSelector();

const seedLegacyRows = action({
  name: "seedLegacyTaskSectionRows",
  args: {},
  handler: function* seedLegacyRows() {
    yield* insert(legacyTaskSectionsMigrationTable, [
      {
        type: "projectCategory",
        id: "section-1",
        title: "Legacy section",
        projectId: "project-1",
        orderToken: "a",
        createdAt: 1,
      },
    ]);
    yield* insert(tasksMigrationTable, [
      {
        type: "task",
        id: "task-1",
        title: "Task",
        state: "todo",
        projectCategoryId: "section-1",
        orderToken: "a",
        lastToggledAt: 1,
        createdAt: 1,
        templateId: null,
        templateDate: null,
      },
    ]);
    yield* insert(taskTemplatesMigrationTable, [
      {
        type: "template",
        id: "template-1",
        title: "Template",
        orderToken: "b",
        repeatRule: "FREQ=DAILY",
        repeatRuleDtStart: 1,
        createdAt: 1,
        lastGeneratedAt: 1,
        projectCategoryId: "section-1",
      },
    ]);
    yield* insert(scheduledTodoTasksMigrationTable, [
      {
        id: "task-1",
        scheduledAt: 2,
        projectCategoryId: "section-1",
      },
    ]);
    yield* insert(changesTable, [
      {
        id: "project_categories:section-1",
        entityId: "section-1",
        tableName: "project_categories",
        createdAt: "1-client",
        updatedAt: "2-client",
        deletedAt: "2-client",
        clientId: "client",
        changes: { type: "1-client" },
      },
      {
        id: "tasks:task-1",
        entityId: "task-1",
        tableName: "tasks",
        createdAt: "1-client",
        updatedAt: "3-client",
        deletedAt: null,
        clientId: "client",
        changes: {
          title: "1-client",
          projectCategoryId: "3-client",
          taskSectionId: "4-client",
        },
      },
    ]);
  },
});

const migratedRows = selector({
  name: "migratedTaskSectionRows",
  args: {},
  handler: function* migratedRows() {
    return {
      sections: yield* selectFrom(taskSectionsTable, "byIds"),
      tasks: yield* selectFrom(tasksTable, "byIds"),
      templates: yield* selectFrom(taskTemplatesTable, "byIds"),
      scheduledTasks: yield* selectFrom(scheduledTodoTasksTable, "byIds"),
      changes: yield* selectFrom(changesTable, "byUpdatedAt"),
    };
  },
});

describe("TaskSection storage migration", () => {
  it("copies legacy sections and rewrites dependent rows and sync metadata", () => {
    const db = new DB(new BptreeInmemDriver());
    execSync(db.loadTables(taskSectionStorageMigrationTables));
    syncDispatch(db, seedLegacyRows({}));

    syncDispatch(db, migrateLegacyTaskSections({}));
    const firstResult = selectSync(db, {
      selector: migratedRows,
      args: {},
    });

    expect(firstResult.sections).toEqual([
      expect.objectContaining({
        id: "section-1",
        type: "taskSection",
      }),
    ]);
    expect(firstResult.tasks).toEqual([
      expect.objectContaining({
        id: "task-1",
        taskSectionId: "section-1",
      }),
    ]);
    expect(firstResult.tasks[0]).not.toHaveProperty("projectCategoryId");
    expect(firstResult.templates[0]).toEqual(
      expect.objectContaining({ taskSectionId: "section-1" }),
    );
    expect(firstResult.scheduledTasks[0]).toEqual(
      expect.objectContaining({ taskSectionId: "section-1" }),
    );

    const sectionChange = firstResult.changes.find(
      (change) => change.entityId === "section-1",
    );
    expect(sectionChange).toEqual(
      expect.objectContaining({
        id: "task_sections:section-1",
        tableName: "task_sections",
        deletedAt: "2-client",
      }),
    );
    const taskChange = firstResult.changes.find(
      (change) => change.entityId === "task-1",
    );
    expect(taskChange?.changes).toEqual({
      title: "1-client",
      taskSectionId: "4-client",
    });

    syncDispatch(db, migrateLegacyTaskSections({}));
    const secondResult = selectSync(db, {
      selector: migratedRows,
      args: {},
    });
    expect(secondResult).toEqual(firstResult);
  });
});
