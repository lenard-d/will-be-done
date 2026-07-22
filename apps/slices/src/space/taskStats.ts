import {
  deleteRows,
  selectFrom,
  type SubscribableDB,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { action, selector } from "../builders";
import {
  type TaskSection,
  type TaskSectionTaskStats,
  type Project,
  type ScheduledTodoTask,
  type Task,
  type TaskProjection,
  type DailyList,
  dailyListsTable,
  taskSectionsTable,
  taskSectionTaskStatsTable,
  projectsTable,
  scheduledTodoTasksTable,
  spaceMigrationsTable,
  taskProjectionsTable,
  tasksTable,
} from "./tables";
import { taskSectionsByProjectId } from "./taskSections";
import { dailyDateFormat } from "./utils";
import { parse } from "date-fns";

const taskSectionTaskStatsMigrationId = "task-section-task-stats-v1";
const scheduledTodoTasksMigrationId = "scheduled-todo-tasks-task-section-v1";

const emptyTaskSectionTaskStats = (id: string): TaskSectionTaskStats => ({
  id,
  total: 0,
  todo: 0,
  done: 0,
});

function applyTaskDelta(
  stats: TaskSectionTaskStats,
  task: Task,
  delta: 1 | -1,
): TaskSectionTaskStats {
  return {
    ...stats,
    total: stats.total + delta,
    [task.state]: stats[task.state] + delta,
  };
}

function normalizeTaskSectionTaskStats(
  stats: TaskSectionTaskStats,
): TaskSectionTaskStats {
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
        taskSectionId: task.taskSectionId,
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

export const rebuildTaskSectionTaskStats = action({
  name: "rebuildTaskSectionTaskStats",
  args: {},
  handler: function* rebuildTaskSectionTaskStats(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingStats = yield* selectFrom(taskSectionTaskStatsTable, "byIds");
    if (existingStats.length > 0) {
      yield* deleteRows(
        taskSectionTaskStatsTable,
        existingStats.map((stats) => stats.id),
      );
    }

    const tasks = yield* selectFrom(tasksTable, "byTaskSectionIdOrderStates");
    const statsBySectionId = new Map<string, TaskSectionTaskStats>();

    for (const task of tasks) {
      const existingStats =
        statsBySectionId.get(task.taskSectionId) ??
        emptyTaskSectionTaskStats(task.taskSectionId);

      statsBySectionId.set(
        task.taskSectionId,
        applyTaskDelta(existingStats, task, 1),
      );
    }

    const nextStats = [...statsBySectionId.values()].filter(
      (stats) => stats.total > 0,
    );
    if (nextStats.length > 0) {
      yield* upsert(taskSectionTaskStatsTable, nextStats);
    }
  },
});

export const migrateTaskSectionTaskStats = action({
  name: "migrateTaskSectionTaskStats",
  args: {},
  handler: function* migrateTaskSectionTaskStats(): Generator<
    unknown,
    void,
    unknown
  > {
    const existingMigration = yield* selectFrom(spaceMigrationsTable, "byId")
      .where((q) => q.eq("id", taskSectionTaskStatsMigrationId))
      .firstOr(null);
    if (existingMigration) return;

    yield* rebuildTaskSectionTaskStats({});
    yield* upsert(spaceMigrationsTable, [
      {
        id: taskSectionTaskStatsMigrationId,
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
    const sections = yield* taskSectionsByProjectId({ projectId });
    const taskSectionIds = sections.map((section) => section.id);
    if (taskSectionIds.length === 0) return 0;

    const stats = yield* selectFrom(taskSectionTaskStatsTable, "byId").where(
      (q) => taskSectionIds.map((id) => q.eq("id", id)),
    );

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

    const sections = yield* selectFrom(
      taskSectionsTable,
      "byProjectIdOrderToken",
    ).where((q) => projects.map((project) => q.eq("projectId", project.id)));
    const taskSectionIds = sections.map((section) => section.id);

    const stats =
      taskSectionIds.length > 0
        ? yield* selectFrom(taskSectionTaskStatsTable, "byId").where((q) =>
            taskSectionIds.map((id) => q.eq("id", id)),
          )
        : [];
    const statsBySectionId = new Map(stats.map((stat) => [stat.id, stat]));

    const notDoneCountByProjectId = new Map<string, number>();
    for (const section of sections) {
      const count = statsBySectionId.get(section.id)?.todo ?? 0;
      notDoneCountByProjectId.set(
        section.projectId,
        (notDoneCountByProjectId.get(section.projectId) ?? 0) + count,
      );
    }

    const sectionById = new Map(
      sections.map((section) => [section.id, section]),
    );
    const overdueScheduledTasks = yield* selectFrom(
      scheduledTodoTasksTable,
      "byScheduledAt",
    ).where((q) => q.lt("scheduledAt", currentDate));
    const overdueCountByProjectId = new Map<string, number>();
    for (const scheduledTask of overdueScheduledTasks) {
      const section = sectionById.get(scheduledTask.taskSectionId);
      if (!section) continue;

      overdueCountByProjectId.set(
        section.projectId,
        (overdueCountByProjectId.get(section.projectId) ?? 0) + 1,
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
    function* updateTaskSectionTaskStats(_db, table, _traits, ops) {
      if (ops.length === 0) return;
      if (table !== tasksTable && table !== taskSectionsTable) return;

      if (table === taskSectionsTable) {
        const deletedSectionIds = ops
          .filter((op) => op.type === "delete")
          .map((op) => (op.oldValue as TaskSection).id);

        if (deletedSectionIds.length > 0) {
          yield* deleteRows(taskSectionTaskStatsTable, deletedSectionIds);
        }
        return;
      }

      const changedSectionIds = new Set<string>();
      for (const op of ops) {
        if (op.type === "insert") {
          changedSectionIds.add((op.newValue as Task).taskSectionId);
        } else if (op.type === "upsert") {
          if (op.oldValue) {
            changedSectionIds.add((op.oldValue as Task).taskSectionId);
          }
          changedSectionIds.add((op.newValue as Task).taskSectionId);
        } else {
          changedSectionIds.add((op.oldValue as Task).taskSectionId);
        }
      }

      if (changedSectionIds.size === 0) return;

      const existingStats = yield* selectFrom(
        taskSectionTaskStatsTable,
        "byId",
      ).where((q) => [...changedSectionIds].map((id) => q.eq("id", id)));
      const statsBySectionId = new Map(
        existingStats.map((stats) => [stats.id, stats]),
      );

      for (const taskSectionId of changedSectionIds) {
        if (!statsBySectionId.has(taskSectionId)) {
          statsBySectionId.set(
            taskSectionId,
            emptyTaskSectionTaskStats(taskSectionId),
          );
        }
      }

      for (const op of ops) {
        if (op.type === "insert") {
          const task = op.newValue as Task;
          const stats = statsBySectionId.get(task.taskSectionId)!;
          statsBySectionId.set(
            task.taskSectionId,
            applyTaskDelta(stats, task, 1),
          );
        } else if (op.type === "upsert") {
          if (op.oldValue) {
            const oldTask = op.oldValue as Task;
            const stats = statsBySectionId.get(oldTask.taskSectionId)!;
            statsBySectionId.set(
              oldTask.taskSectionId,
              applyTaskDelta(stats, oldTask, -1),
            );
          }

          const newTask = op.newValue as Task;
          const stats = statsBySectionId.get(newTask.taskSectionId)!;
          statsBySectionId.set(
            newTask.taskSectionId,
            applyTaskDelta(stats, newTask, 1),
          );
        } else {
          const task = op.oldValue as Task;
          const stats = statsBySectionId.get(task.taskSectionId)!;
          statsBySectionId.set(
            task.taskSectionId,
            applyTaskDelta(stats, task, -1),
          );
        }
      }

      const nextStats: TaskSectionTaskStats[] = [];
      const emptyStatsIds: string[] = [];

      for (const stats of statsBySectionId.values()) {
        const normalizedStats = normalizeTaskSectionTaskStats(stats);
        if (normalizedStats.total <= 0) {
          emptyStatsIds.push(normalizedStats.id);
        } else {
          nextStats.push(normalizedStats);
        }
      }

      if (nextStats.length > 0) {
        yield* upsert(taskSectionTaskStatsTable, nextStats);
      }
      if (emptyStatsIds.length > 0) {
        yield* deleteRows(taskSectionTaskStatsTable, emptyStatsIds);
      }
    },
  );

  db.afterChange(function* updateScheduledTodoTasks(_db, table, _traits, ops) {
    if (ops.length === 0) return;
    if (
      table !== tasksTable &&
      table !== taskProjectionsTable &&
      table !== dailyListsTable &&
      table !== taskSectionsTable
    ) {
      return;
    }

    if (table === taskSectionsTable) {
      const deletedSectionIds = ops
        .filter((op) => op.type === "delete")
        .map((op) => (op.oldValue as TaskSection).id);
      if (deletedSectionIds.length === 0) return;

      const staleRows = yield* selectFrom(
        scheduledTodoTasksTable,
        "byTaskSectionId",
      ).where((q) =>
        deletedSectionIds.map((taskSectionId) =>
          q.eq("taskSectionId", taskSectionId),
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
