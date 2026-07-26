import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  createTaskInSection,
  deleteTaskById,
  projectSectionById,
  projectSectionItems,
  taskById,
  updateTask as updateTaskAction,
  type Item,
  type Task,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
import { InvalidPlacementError, ResourceNotFoundError } from "./errors";
import {
  resolveCreatePosition,
  resolveOrderToken,
  type Placement,
} from "./placement";

export type { Placement } from "./placement";

export type PublicTaskState = "todo" | "done";
export type PublicTaskNature = "red" | "green" | "unknown";

export interface PublicTask {
  type: "task";
  id: string;
  title: string;
  content?: string;
  state: PublicTaskState;
  projectSectionId: string;
  nature: PublicTaskNature;
  createdAt: number;
  lastToggledAt: number;
}

export function toPublicTask(task: Task): PublicTask {
  return {
    type: "task",
    id: task.id,
    title: task.title,
    ...(task.content === undefined ? {} : { content: task.content }),
    state: task.state,
    projectSectionId: task.projectSectionId,
    nature: task.nature ?? "unknown",
    createdAt: task.createdAt,
    lastToggledAt: task.lastToggledAt,
  };
}

function getSpaceDatabase(spaceId: string, userId: string) {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  return getHyperDB(spaceDBConfig(spaceId)).db;
}

function requireSection(
  db: ReturnType<typeof getSpaceDatabase>,
  sectionId: string,
) {
  const section = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!section) throw new ResourceNotFoundError("Project section");
  return section;
}

function itemsInSection(
  db: ReturnType<typeof getSpaceDatabase>,
  sectionId: string,
  excludedId?: string,
): Item[] {
  return selectSync(db, {
    selector: projectSectionItems,
    args: { projectSectionId: sectionId },
  }).filter((item) => item.id !== excludedId);
}

export function getTask({
  spaceId,
  taskId,
  userId,
}: {
  spaceId: string;
  taskId: string;
  userId: string;
}): PublicTask {
  const db = getSpaceDatabase(spaceId, userId);
  const task = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!task) throw new ResourceNotFoundError("Task");
  return toPublicTask(task);
}

export function createSectionTask({
  spaceId,
  sectionId,
  userId,
  title,
  content,
  nature,
  placement = { kind: "last" },
}: {
  spaceId: string;
  sectionId: string;
  userId: string;
  title: string;
  content?: string;
  nature?: PublicTaskNature;
  placement?: Placement;
}): PublicTask {
  const db = getSpaceDatabase(spaceId, userId);
  requireSection(db, sectionId);
  const position = resolveCreatePosition({
    entities:
      placement.kind === "before" || placement.kind === "after"
        ? itemsInSection(db, sectionId)
        : [],
    placement,
  });

  const task = syncDispatch(
    db,
    createTaskInSection({
      projectSectionId: sectionId,
      position,
      taskAttrs: {
        title,
        ...(content === undefined ? {} : { content }),
        ...(nature === undefined ? {} : { nature }),
      },
    }),
  );
  return toPublicTask(task);
}

export function updateTask({
  spaceId,
  taskId,
  userId,
  updates,
}: {
  spaceId: string;
  taskId: string;
  userId: string;
  updates: {
    title?: string;
    content?: string;
    state?: PublicTaskState;
    nature?: PublicTaskNature;
  };
}): PublicTask {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!current) throw new ResourceNotFoundError("Task");

  syncDispatch(
    db,
    updateTaskAction({
      id: taskId,
      task: {
        ...(updates.title === undefined ? {} : { title: updates.title }),
        ...(updates.content === undefined ? {} : { content: updates.content }),
        ...(updates.nature === undefined ? {} : { nature: updates.nature }),
        ...(updates.state === undefined ? {} : { state: updates.state }),
        ...(updates.state !== undefined && updates.state !== current.state
          ? { lastToggledAt: Date.now() }
          : {}),
      },
    }),
  );

  return getTask({ spaceId, taskId, userId });
}

export function moveTask({
  spaceId,
  taskId,
  userId,
  projectSectionId,
  placement,
}: {
  spaceId: string;
  taskId: string;
  userId: string;
  projectSectionId: string;
  placement: Placement;
}): PublicTask {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!current) throw new ResourceNotFoundError("Task");
  if (current.state === "done") {
    throw new InvalidPlacementError("Completed tasks cannot be moved");
  }
  requireSection(db, projectSectionId);

  syncDispatch(
    db,
    updateTaskAction({
      id: taskId,
      task: {
        projectSectionId,
        orderToken: resolveOrderToken({
          entities: itemsInSection(db, projectSectionId, taskId),
          placement,
        }),
      },
    }),
  );
  return getTask({ spaceId, taskId, userId });
}

export function deleteTask({
  spaceId,
  taskId,
  userId,
}: {
  spaceId: string;
  taskId: string;
  userId: string;
}): void {
  const db = getSpaceDatabase(spaceId, userId);
  const task = selectSync(db, { selector: taskById, args: { id: taskId } });
  if (!task) throw new ResourceNotFoundError("Task");
  syncDispatch(db, deleteTaskById({ id: taskId }));
}
