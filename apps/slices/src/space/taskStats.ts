import {
  deleteRows,
  selectFrom,
  type SubscribableDB,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import {
  type ProjectCategory,
  type ProjectCategoryTaskStats,
  type Project,
  type ScheduledTodoTask,
  type Task,
  type TaskProjection,
  type DailyList,
  dailyListsTable,
  projectCategoriesTable,
  projectCategoryTaskStatsTable,
  projectsTable,
  scheduledTodoTasksTable,
  spaceMigrationsTable,
  taskProjectionsTable,
  tasksTable,
} from "./tables";
import { projectCategoriesByProjectId } from "./projectsCategories";
import { dailyDateFormat } from "./utils";
import { parse } from "date-fns";

const projectCategoryTaskStatsMigrationId = "project-category-task-stats-v1";
const scheduledTodoTasksMigrationId = "scheduled-todo-tasks-v1";

const emptyProjectCategoryTaskStats = (
  id: string,
): ProjectCategoryTaskStats => ({
  id,
  total: 0,
  todo: 0,
  done: 0,
});

function applyTaskDelta(
  stats: ProjectCategoryTaskStats,
  task: Task,
  delta: 1 | -1,
): ProjectCategoryTaskStats {
  return {
    ...stats,
    total: stats.total + delta,
    [task.state]: stats[task.state] + delta,
  };
}

function normalizeProjectCategoryTaskStats(
  stats: ProjectCategoryTaskStats,
): ProjectCategoryTaskStats {
  return {
    ...stats,
    total: Math.max(0, stats.total),
    todo: Math.max(0, stats.todo),
    done: Math.max(0, stats.done),
  };
}

function getScheduledAt(dailyList: DailyList): number {
  return parse(dailyList.date, dailyDateFormat, new Date()).getTime();
}

function* refreshScheduledTodoTasks(
  taskIds: Iterable<string>,
): Generator<unknown, void, unknown> {
  const uniqueTaskIds = [...new Set(taskIds)];
  if (uniqueTaskIds.length === 0) return;

  const tasks = yield* selectFrom(tasksTable, "byId").where((q) =>
    uniqueTaskIds.map((id) => q.eq("id", id)),
  );
  const taskById = new Map((tasks as Task[]).map((task) => [task.id, task]));

  const projections = yield* selectFrom(taskProjectionsTable, "byId").where(
    (q) => uniqueTaskIds.map((id) => q.eq("id", id)),
  );
  const projectionByTaskId = new Map(
    (projections as TaskProjection[]).map((projection) => [
      projection.id,
      projection,
    ]),
  );
  const dailyListIds = [
    ...new Set(
      (projections as TaskProjection[]).map(
        (projection) => projection.dailyListId,
      ),
    ),
  ];
  const dailyLists =
    dailyListIds.length > 0
      ? yield* selectFrom(dailyListsTable, "byId").where((q) =>
          dailyListIds.map((id) => q.eq("id", id)),
        )
      : [];
  const dailyListById = new Map(
    (dailyLists as DailyList[]).map((dailyList) => [dailyList.id, dailyList]),
  );

  const nextRows: ScheduledTodoTask[] = [];
  const staleIds: string[] = [];

  for (const taskId of uniqueTaskIds) {
    const task = taskById.get(taskId);
    const projection = projectionByTaskId.get(taskId);
    const dailyList = projection
      ? dailyListById.get(projection.dailyListId)
      : undefined;

    if (task?.state === "todo" && dailyList) {
      nextRows.push({
        id: task.id,
        scheduledAt: getScheduledAt(dailyList),
        projectCategoryId: task.projectCategoryId,
      });
    } else {
      staleIds.push(taskId);
    }
  }

  if (nextRows.length > 0) {
    yield* upsert(scheduledTodoTasksTable, nextRows);
  }
  if (staleIds.length > 0) {
    yield* deleteRows(scheduledTodoTasksTable, staleIds);
  }
}

function* refreshScheduledTodoTasksForDailyLists(
  dailyListIds: Iterable<string>,
): Generator<unknown, void, unknown> {
  const uniqueDailyListIds = [...new Set(dailyListIds)];
  if (uniqueDailyListIds.length === 0) return;

  const projections = yield* selectFrom(
    taskProjectionsTable,
    "byDailyListIdTokenOrdered",
  ).where((q) =>
    uniqueDailyListIds.map((dailyListId) => q.eq("dailyListId", dailyListId)),
  );

  yield* refreshScheduledTodoTasks(
    (projections as TaskProjection[]).map((projection) => projection.id),
  );
}

export const rebuildProjectCategoryTaskStats = action({
  name: "rebuildProjectCategoryTaskStats",
  args: {},
  handler: function* rebuildProjectCategoryTaskStats(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingStats = yield* selectFrom(
      projectCategoryTaskStatsTable,
      "byIds",
    );
    if (existingStats.length > 0) {
      yield* deleteRows(
        projectCategoryTaskStatsTable,
        existingStats.map((stats) => stats.id),
      );
    }

    const tasks = yield* selectFrom(tasksTable, "byCategoryIdOrderStates");
    const statsByCategoryId = new Map<string, ProjectCategoryTaskStats>();

    for (const task of tasks) {
      const existingStats =
        statsByCategoryId.get(task.projectCategoryId) ??
        emptyProjectCategoryTaskStats(task.projectCategoryId);

      statsByCategoryId.set(
        task.projectCategoryId,
        applyTaskDelta(existingStats, task, 1),
      );
    }

    const nextStats = [...statsByCategoryId.values()].filter(
      (stats) => stats.total > 0,
    );
    if (nextStats.length > 0) {
      yield* upsert(projectCategoryTaskStatsTable, nextStats);
    }
  },
});

export const migrateProjectCategoryTaskStats = action({
  name: "migrateProjectCategoryTaskStats",
  args: {},
  handler: function* migrateProjectCategoryTaskStats(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingMigration = yield* selectFrom(spaceMigrationsTable, "byId")
      .where((q) => q.eq("id", projectCategoryTaskStatsMigrationId))
      .firstOr(null);
    if (existingMigration) return;

    yield* rebuildProjectCategoryTaskStats({});
    yield* upsert(spaceMigrationsTable, [
      {
        id: projectCategoryTaskStatsMigrationId,
        appliedAt: Date.now(),
      },
    ]);
  },
});

export const rebuildScheduledTodoTasks = action({
  name: "rebuildScheduledTodoTasks",
  args: {},
  handler: function* rebuildScheduledTodoTasks(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingRows = yield* selectFrom(scheduledTodoTasksTable, "byIds");
    if (existingRows.length > 0) {
      yield* deleteRows(
        scheduledTodoTasksTable,
        existingRows.map((row) => row.id),
      );
    }

    const projections = yield* selectFrom(taskProjectionsTable, "byIds");
    yield* refreshScheduledTodoTasks(
      (projections as TaskProjection[]).map((projection) => projection.id),
    );
  },
});

export const migrateScheduledTodoTasks = action({
  name: "migrateScheduledTodoTasks",
  args: {},
  handler: function* migrateScheduledTodoTasks(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingMigration = yield* selectFrom(spaceMigrationsTable, "byId")
      .where((q) => q.eq("id", scheduledTodoTasksMigrationId))
      .firstOr(null);
    if (existingMigration) return;

    yield* rebuildScheduledTodoTasks({});
    yield* upsert(spaceMigrationsTable, [
      {
        id: scheduledTodoTasksMigrationId,
        appliedAt: Date.now(),
      },
    ]);
  },
});

export const projectTasksCount = selector({
  name: "projectTasksCount",
  args: { projectId: v.string() },
  handler: function* projectTasksCount({ projectId }) {
    const categories = yield* projectCategoriesByProjectId({ projectId });
    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.length === 0) return 0;

    const stats = yield* selectFrom(
      projectCategoryTaskStatsTable,
      "byId",
    ).where((q) => categoryIds.map((id) => q.eq("id", id)));

    return stats.reduce((count, stat) => count + stat.todo, 0);
  },
});

export type ProjectWithTaskStats = {
  project: Project;
  notDoneCount: number;
  overdueCount: number;
};

export const projectsWithTaskStats = selector({
  name: "projectsWithTaskStats",
  args: { currentDate: v.number() },
  handler: function* ({
    currentDate,
  }): Generator<unknown, ProjectWithTaskStats[], unknown> {
    const projects = yield* selectFrom(projectsTable, "byOrderToken");
    if (projects.length === 0) return [];

    const categories = yield* selectFrom(
      projectCategoriesTable,
      "byProjectIdOrderToken",
    ).where((q) => projects.map((project) => q.eq("projectId", project.id)));
    const categoryIds = categories.map((category) => category.id);

    const stats =
      categoryIds.length > 0
        ? yield* selectFrom(projectCategoryTaskStatsTable, "byId").where((q) =>
            categoryIds.map((id) => q.eq("id", id)),
          )
        : [];
    const statsByCategoryId = new Map(stats.map((stat) => [stat.id, stat]));

    const notDoneCountByProjectId = new Map<string, number>();
    for (const category of categories) {
      const count = statsByCategoryId.get(category.id)?.todo ?? 0;
      notDoneCountByProjectId.set(
        category.projectId,
        (notDoneCountByProjectId.get(category.projectId) ?? 0) + count,
      );
    }

    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const overdueScheduledTasks = yield* selectFrom(
      scheduledTodoTasksTable,
      "byScheduledAt",
    ).where((q) => q.lt("scheduledAt", currentDate));
    const overdueCountByProjectId = new Map<string, number>();
    for (const scheduledTask of overdueScheduledTasks) {
      const category = categoryById.get(scheduledTask.projectCategoryId);
      if (!category) continue;

      overdueCountByProjectId.set(
        category.projectId,
        (overdueCountByProjectId.get(category.projectId) ?? 0) + 1,
      );
    }

    return projects.map((project) => ({
      project,
      notDoneCount: notDoneCountByProjectId.get(project.id) ?? 0,
      overdueCount: overdueCountByProjectId.get(project.id) ?? 0,
    }));
  },
});

export function installProjectTaskStatsHooks(db: SubscribableDB) {
  db.afterChange(
    function* updateProjectCategoryTaskStats(_db, table, _traits, ops) {
      if (ops.length === 0) return;
      if (table !== tasksTable && table !== projectCategoriesTable) return;

      if (table === projectCategoriesTable) {
        const deletedCategoryIds = ops
          .filter((op) => op.type === "delete")
          .map((op) => (op.oldValue as ProjectCategory).id);

        if (deletedCategoryIds.length > 0) {
          yield* deleteRows(projectCategoryTaskStatsTable, deletedCategoryIds);
        }
        return;
      }

      const changedCategoryIds = new Set<string>();
      for (const op of ops) {
        if (op.type === "insert") {
          changedCategoryIds.add((op.newValue as Task).projectCategoryId);
        } else if (op.type === "upsert") {
          if (op.oldValue) {
            changedCategoryIds.add((op.oldValue as Task).projectCategoryId);
          }
          changedCategoryIds.add((op.newValue as Task).projectCategoryId);
        } else {
          changedCategoryIds.add((op.oldValue as Task).projectCategoryId);
        }
      }

      if (changedCategoryIds.size === 0) return;

      const existingStats = yield* selectFrom(
        projectCategoryTaskStatsTable,
        "byId",
      ).where((q) => [...changedCategoryIds].map((id) => q.eq("id", id)));
      const statsByCategoryId = new Map(
        existingStats.map((stats) => [stats.id, stats]),
      );

      for (const categoryId of changedCategoryIds) {
        if (!statsByCategoryId.has(categoryId)) {
          statsByCategoryId.set(
            categoryId,
            emptyProjectCategoryTaskStats(categoryId),
          );
        }
      }

      for (const op of ops) {
        if (op.type === "insert") {
          const task = op.newValue as Task;
          const stats = statsByCategoryId.get(task.projectCategoryId)!;
          statsByCategoryId.set(
            task.projectCategoryId,
            applyTaskDelta(stats, task, 1),
          );
        } else if (op.type === "upsert") {
          if (op.oldValue) {
            const oldTask = op.oldValue as Task;
            const stats = statsByCategoryId.get(oldTask.projectCategoryId)!;
            statsByCategoryId.set(
              oldTask.projectCategoryId,
              applyTaskDelta(stats, oldTask, -1),
            );
          }

          const newTask = op.newValue as Task;
          const stats = statsByCategoryId.get(newTask.projectCategoryId)!;
          statsByCategoryId.set(
            newTask.projectCategoryId,
            applyTaskDelta(stats, newTask, 1),
          );
        } else {
          const task = op.oldValue as Task;
          const stats = statsByCategoryId.get(task.projectCategoryId)!;
          statsByCategoryId.set(
            task.projectCategoryId,
            applyTaskDelta(stats, task, -1),
          );
        }
      }

      const nextStats: ProjectCategoryTaskStats[] = [];
      const emptyStatsIds: string[] = [];

      for (const stats of statsByCategoryId.values()) {
        const normalizedStats = normalizeProjectCategoryTaskStats(stats);
        if (normalizedStats.total <= 0) {
          emptyStatsIds.push(normalizedStats.id);
        } else {
          nextStats.push(normalizedStats);
        }
      }

      if (nextStats.length > 0) {
        yield* upsert(projectCategoryTaskStatsTable, nextStats);
      }
      if (emptyStatsIds.length > 0) {
        yield* deleteRows(projectCategoryTaskStatsTable, emptyStatsIds);
      }
    },
  );

  db.afterChange(function* updateScheduledTodoTasks(_db, table, _traits, ops) {
    if (ops.length === 0) return;
    if (
      table !== tasksTable &&
      table !== taskProjectionsTable &&
      table !== dailyListsTable &&
      table !== projectCategoriesTable
    ) {
      return;
    }

    if (table === projectCategoriesTable) {
      const deletedCategoryIds = ops
        .filter((op) => op.type === "delete")
        .map((op) => (op.oldValue as ProjectCategory).id);
      if (deletedCategoryIds.length === 0) return;

      const staleRows = yield* selectFrom(
        scheduledTodoTasksTable,
        "byProjectCategoryId",
      ).where((q) =>
        deletedCategoryIds.map((categoryId) =>
          q.eq("projectCategoryId", categoryId),
        ),
      );
      if (staleRows.length > 0) {
        yield* deleteRows(
          scheduledTodoTasksTable,
          staleRows.map((row) => row.id),
        );
      }
      return;
    }

    if (table === dailyListsTable) {
      const changedDailyListIds = new Set<string>();
      for (const op of ops) {
        if (op.type === "insert") {
          changedDailyListIds.add((op.newValue as DailyList).id);
        } else if (op.type === "upsert") {
          if (op.oldValue) {
            changedDailyListIds.add((op.oldValue as DailyList).id);
          }
          changedDailyListIds.add((op.newValue as DailyList).id);
        } else {
          changedDailyListIds.add((op.oldValue as DailyList).id);
        }
      }

      yield* refreshScheduledTodoTasksForDailyLists(changedDailyListIds);
      return;
    }

    const changedTaskIds = new Set<string>();
    for (const op of ops) {
      if (op.type === "insert") {
        changedTaskIds.add((op.newValue as Task | TaskProjection).id);
      } else if (op.type === "upsert") {
        if (op.oldValue) {
          changedTaskIds.add((op.oldValue as Task | TaskProjection).id);
        }
        changedTaskIds.add((op.newValue as Task | TaskProjection).id);
      } else {
        changedTaskIds.add((op.oldValue as Task | TaskProjection).id);
      }
    }

    yield* refreshScheduledTodoTasks(changedTaskIds);
  });
}
