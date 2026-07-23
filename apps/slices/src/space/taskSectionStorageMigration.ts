import {
  defineTable,
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import { changesTable, type Change } from "../common/tables";
import {
  spaceMigrationsTable,
  taskSectionType,
  taskSectionsTable,
  taskType,
} from "./tables";

export const legacyTaskSectionsTableName = "project_categories";
export const taskSectionsTableName = "task_sections";
export const taskSectionStorageMigrationId = "task-section-storage-v1";

export type PersistedSpaceRow = Record<string, unknown> & { id: string };

export type MigratedSpaceRow = {
  tableName: string;
  row: PersistedSpaceRow;
  changed: boolean;
};

const moveProperty = (
  row: PersistedSpaceRow,
  legacyKey: string,
  nextKey: string,
): PersistedSpaceRow => {
  if (!(legacyKey in row)) return row;

  const nextRow = {
    ...row,
    [nextKey]: nextKey in row ? row[nextKey] : row[legacyKey],
  };
  delete nextRow[legacyKey];
  return nextRow;
};

export function migratePersistedSpaceRow(
  tableName: string,
  row: PersistedSpaceRow,
): MigratedSpaceRow {
  if (tableName === legacyTaskSectionsTableName) {
    return {
      tableName: taskSectionsTableName,
      row: {
        ...row,
        type: row.type === "projectCategory" ? "taskSection" : row.type,
      },
      changed: true,
    };
  }

  if (tableName === "tasks" || tableName === "task_templates") {
    const nextRow = moveProperty(row, "projectCategoryId", "taskSectionId");
    return { tableName, row: nextRow, changed: nextRow !== row };
  }

  if (tableName === "changes") {
    let nextRow = row;
    const changes = row.changes;
    if (
      typeof changes === "object" &&
      changes !== null &&
      "projectCategoryId" in changes
    ) {
      const nextChanges: Record<string, unknown> = {
        ...(changes as Record<string, unknown>),
        taskSectionId:
          "taskSectionId" in changes
            ? (changes as Record<string, unknown>).taskSectionId
            : (changes as Record<string, unknown>).projectCategoryId,
      };
      delete nextChanges.projectCategoryId;
      nextRow = { ...nextRow, changes: nextChanges };
    }

    if (row.tableName === legacyTaskSectionsTableName) {
      nextRow = {
        ...nextRow,
        id: `${taskSectionsTableName}:${String(row.entityId)}`,
        tableName: taskSectionsTableName,
      };
    }

    return { tableName, row: nextRow, changed: nextRow !== row };
  }

  return { tableName, row, changed: false };
}

export const legacyTaskSectionsMigrationTable = defineTable(
  legacyTaskSectionsTableName,
  {
    type: v.literal("projectCategory"),
    id: v.string(),
    orderToken: v.string(),
    title: v.string(),
    projectId: v.string(),
    createdAt: v.number(),
  },
).index("byIds", ["id"]);

export const tasksMigrationTable = defineTable("tasks", {
  type: v.literal(taskType),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  state: v.union(v.literal("todo"), v.literal("done")),
  projectCategoryId: v.optional(v.string()),
  taskSectionId: v.optional(v.string()),
  orderToken: v.string(),
  lastToggledAt: v.number(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
  createdAt: v.number(),
  templateId: v.union(v.string(), v.null()),
  templateDate: v.union(v.number(), v.null()),
}).index("byIds", ["id"]);

export const taskTemplatesMigrationTable = defineTable("task_templates", {
  type: v.literal("template"),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  orderToken: v.string(),
  repeatRule: v.string(),
  repeatRuleDtStart: v.number(),
  createdAt: v.number(),
  lastGeneratedAt: v.number(),
  projectCategoryId: v.optional(v.string()),
  taskSectionId: v.optional(v.string()),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
}).index("byIds", ["id"]);

export const scheduledTodoTasksMigrationTable = defineTable(
  "scheduled_todo_tasks",
  {
    id: v.string(),
    scheduledAt: v.number(),
    projectCategoryId: v.optional(v.string()),
    taskSectionId: v.optional(v.string()),
  },
).index("byIds", ["id"]);

export const taskSectionStorageMigrationTables = [
  legacyTaskSectionsMigrationTable,
  taskSectionsTable,
  tasksMigrationTable,
  taskTemplatesMigrationTable,
  scheduledTodoTasksMigrationTable,
  changesTable,
  spaceMigrationsTable,
];

export const isTaskSectionStorageMigrationApplied = selector({
  name: "isTaskSectionStorageMigrationApplied",
  args: {},
  handler: function* isTaskSectionStorageMigrationApplied() {
    return Boolean(
      yield* selectFrom(spaceMigrationsTable, "byId")
        .where((q) => q.eq("id", taskSectionStorageMigrationId))
        .firstOr(null),
    );
  },
});

export const migrateLegacyTaskSections = action({
  name: "migrateLegacyTaskSections",
  args: {},
  handler: function* migrateLegacyTaskSections() {
    const existingMigration = yield* selectFrom(spaceMigrationsTable, "byId")
      .where((q) => q.eq("id", taskSectionStorageMigrationId))
      .firstOr(null);
    if (existingMigration) return;

    const legacySections = yield* selectFrom(
      legacyTaskSectionsMigrationTable,
      "byIds",
    );
    const currentSectionIds = new Set(
      (yield* selectFrom(taskSectionsTable, "byIds")).map((row) => row.id),
    );
    const sectionsToInsert = legacySections
      .filter((row) => !currentSectionIds.has(row.id))
      .map((row) => ({
        ...row,
        type: taskSectionType as "taskSection",
      }));
    if (sectionsToInsert.length > 0) {
      yield* insert(taskSectionsTable, sectionsToInsert);
    }

    const tasks = yield* selectFrom(tasksMigrationTable, "byIds");
    const tasksToMigrate = tasks.flatMap(
      ({ projectCategoryId, taskSectionId, ...task }) => {
        const nextTaskSectionId = taskSectionId ?? projectCategoryId;
        return projectCategoryId !== undefined &&
          nextTaskSectionId !== undefined
          ? [{ ...task, taskSectionId: nextTaskSectionId }]
          : [];
      },
    );
    if (tasksToMigrate.length > 0) {
      yield* upsert(tasksMigrationTable, tasksToMigrate);
    }

    const templates = yield* selectFrom(taskTemplatesMigrationTable, "byIds");
    const templatesToMigrate = templates.flatMap(
      ({ projectCategoryId, taskSectionId, ...template }) => {
        const nextTaskSectionId = taskSectionId ?? projectCategoryId;
        return projectCategoryId !== undefined &&
          nextTaskSectionId !== undefined
          ? [{ ...template, taskSectionId: nextTaskSectionId }]
          : [];
      },
    );
    if (templatesToMigrate.length > 0) {
      yield* upsert(taskTemplatesMigrationTable, templatesToMigrate);
    }

    const scheduledTasks = yield* selectFrom(
      scheduledTodoTasksMigrationTable,
      "byIds",
    );
    const scheduledTasksToMigrate = scheduledTasks.flatMap(
      ({ projectCategoryId, taskSectionId, ...scheduledTask }) => {
        const nextTaskSectionId = taskSectionId ?? projectCategoryId;
        return projectCategoryId !== undefined &&
          nextTaskSectionId !== undefined
          ? [{ ...scheduledTask, taskSectionId: nextTaskSectionId }]
          : [];
      },
    );
    if (scheduledTasksToMigrate.length > 0) {
      yield* upsert(scheduledTodoTasksMigrationTable, scheduledTasksToMigrate);
    }

    const changes = (yield* selectFrom(
      changesTable,
      "byUpdatedAt",
    )) as Change[];
    const changeIds = new Set(changes.map((change) => change.id));
    const changesToUpsert: Change[] = [];
    const changeIdsToDelete: string[] = [];

    for (const change of changes) {
      const migrated = migratePersistedSpaceRow(changesTable.tableName, change);
      if (!migrated.changed) continue;

      const migratedChange = migrated.row as Change;
      if (migratedChange.id !== change.id) {
        changeIdsToDelete.push(change.id);
        if (changeIds.has(migratedChange.id)) continue;
      }
      changesToUpsert.push(migratedChange);
    }

    if (changesToUpsert.length > 0) {
      yield* upsert(changesTable, changesToUpsert);
    }
    if (changeIdsToDelete.length > 0) {
      yield* deleteRows(changesTable, changeIdsToDelete);
    }

    yield* upsert(spaceMigrationsTable, [
      {
        id: taskSectionStorageMigrationId,
        appliedAt: Date.now(),
      },
    ]);
  },
});
