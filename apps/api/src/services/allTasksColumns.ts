import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  allTasksColumnById,
  allTasksColumns,
  createAllTasksColumn as createColumn,
  updateAllTasksColumn as updateColumn,
  deleteAllTasksColumn as deleteColumn,
  moveAllTasksColumn as moveColumn,
  type AllTasksColumn,
} from "@will-be-done/slices/space";
import { getSpaceDatabase } from "./databaseAccess";
import { ConflictError, ResourceNotFoundError } from "./errors";

type Access = { spaceId: string; userId: string };
type ColumnAccess = Access & { columnId: string };

function publicColumn({ id, title, createdAt, filtersJson }: AllTasksColumn) {
  return { id, title, createdAt, filtersJson };
}

function requireColumn(db: ReturnType<typeof getSpaceDatabase>, id: string) {
  const column = selectSync(db, { selector: allTasksColumnById, args: { id } });
  if (!column) throw new ResourceNotFoundError("All tasks column");
  return column;
}

export function listAllTasksColumns({ spaceId, userId }: Access) {
  const db = getSpaceDatabase(spaceId, userId);
  return selectSync(db, { selector: allTasksColumns, args: {} }).map(
    publicColumn,
  );
}

export function createAllTasksColumn({
  spaceId,
  userId,
  ...draft
}: Access & {
  title: string;
  filtersJson: string;
  afterId?: string;
}) {
  const db = getSpaceDatabase(spaceId, userId);
  if (draft.afterId !== undefined) requireColumn(db, draft.afterId);
  return publicColumn(syncDispatch(db, createColumn(draft)));
}

export function updateAllTasksColumn({
  spaceId,
  userId,
  columnId,
  ...updates
}: ColumnAccess & {
  title?: string;
  filtersJson?: string;
}) {
  const db = getSpaceDatabase(spaceId, userId);
  requireColumn(db, columnId);
  return publicColumn(
    syncDispatch(db, updateColumn({ id: columnId, ...updates })),
  );
}

export function moveAllTasksColumn({
  spaceId,
  userId,
  columnId,
  direction,
}: ColumnAccess & {
  direction: "left" | "right";
}) {
  const db = getSpaceDatabase(spaceId, userId);
  requireColumn(db, columnId);
  return publicColumn(
    syncDispatch(db, moveColumn({ id: columnId, direction })),
  );
}

export function deleteAllTasksColumn({
  spaceId,
  userId,
  columnId,
}: ColumnAccess) {
  const db = getSpaceDatabase(spaceId, userId);
  requireColumn(db, columnId);
  if (selectSync(db, { selector: allTasksColumns, args: {} }).length <= 1) {
    throw new ConflictError("The final All tasks column cannot be deleted");
  }
  syncDispatch(db, deleteColumn({ id: columnId }));
}
