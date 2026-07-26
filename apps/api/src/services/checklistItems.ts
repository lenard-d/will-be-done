import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  checklistItemById,
  checklistItemChildren,
  createItem,
  deleteItems,
  setChecklistItemState,
  taskById,
  taskTemplateById,
  updateItem,
  type ChecklistItem,
  type ChecklistParentType,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
import { ResourceNotFoundError } from "./errors";
import { resolveOrderToken, type Placement } from "./placement";

export interface PublicChecklistItem {
  type: "checklistItem";
  id: string;
  parentId: string;
  parentType: ChecklistParentType;
  state: "todo" | "done";
  content: string;
  createdAt: number;
  checkedAt: number | null;
}

function toPublicChecklistItem(item: ChecklistItem): PublicChecklistItem {
  return {
    type: "checklistItem",
    id: item.id,
    parentId: item.parentId,
    parentType: item.parentType,
    state: item.state,
    content: item.content,
    createdAt: item.createdAt,
    checkedAt: item.checkedAt,
  };
}

function getSpaceDatabase(spaceId: string, userId: string) {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  return getHyperDB(spaceDBConfig(spaceId)).db;
}

function requireParent(
  db: ReturnType<typeof getSpaceDatabase>,
  parentType: ChecklistParentType,
  parentId: string,
) {
  const parent =
    parentType === "task"
      ? selectSync(db, { selector: taskById, args: { id: parentId } })
      : selectSync(db, {
          selector: taskTemplateById,
          args: { id: parentId },
        });
  if (!parent) {
    throw new ResourceNotFoundError(
      parentType === "task" ? "Task" : "Task template",
    );
  }
}

function parentItems(
  db: ReturnType<typeof getSpaceDatabase>,
  parentType: ChecklistParentType,
  parentId: string,
  excludedId?: string,
) {
  return selectSync(db, {
    selector: checklistItemChildren,
    args: { parentType, parentId },
  }).filter((item) => item.id !== excludedId);
}

export function listChecklistItems({
  spaceId,
  userId,
  parentType,
  parentId,
}: {
  spaceId: string;
  userId: string;
  parentType: ChecklistParentType;
  parentId: string;
}): PublicChecklistItem[] {
  const db = getSpaceDatabase(spaceId, userId);
  requireParent(db, parentType, parentId);
  return parentItems(db, parentType, parentId).map(toPublicChecklistItem);
}

export function getChecklistItem({
  spaceId,
  userId,
  checklistItemId,
}: {
  spaceId: string;
  userId: string;
  checklistItemId: string;
}): PublicChecklistItem {
  const db = getSpaceDatabase(spaceId, userId);
  const item = selectSync(db, {
    selector: checklistItemById,
    args: { id: checklistItemId },
  });
  if (!item) throw new ResourceNotFoundError("Checklist item");
  return toPublicChecklistItem(item);
}

export function createChecklistItem({
  spaceId,
  userId,
  parentType,
  parentId,
  content,
  state = "todo",
  placement = { kind: "last" },
}: {
  spaceId: string;
  userId: string;
  parentType: ChecklistParentType;
  parentId: string;
  content: string;
  state?: "todo" | "done";
  placement?: Placement;
}): PublicChecklistItem {
  const db = getSpaceDatabase(spaceId, userId);
  requireParent(db, parentType, parentId);

  const item = syncDispatch(
    db,
    createItem({
      item: {
        parentType,
        parentId,
        content,
        state,
        checkedAt: state === "done" ? Date.now() : null,
        orderToken: resolveOrderToken({
          entities: parentItems(db, parentType, parentId),
          placement,
        }),
      },
    }),
  );
  return toPublicChecklistItem(item);
}

export function updateChecklistItem({
  spaceId,
  userId,
  checklistItemId,
  updates,
}: {
  spaceId: string;
  userId: string;
  checklistItemId: string;
  updates: { content?: string; state?: "todo" | "done" };
}): PublicChecklistItem {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: checklistItemById,
    args: { id: checklistItemId },
  });
  if (!current) throw new ResourceNotFoundError("Checklist item");

  if (updates.content !== undefined) {
    syncDispatch(
      db,
      updateItem({
        id: checklistItemId,
        item: { content: updates.content },
      }),
    );
  }
  if (updates.state !== undefined && updates.state !== current.state) {
    syncDispatch(
      db,
      setChecklistItemState({
        id: checklistItemId,
        state: updates.state,
      }),
    );
  }

  return getChecklistItem({ spaceId, userId, checklistItemId });
}

export function moveChecklistItem({
  spaceId,
  userId,
  checklistItemId,
  parentType,
  parentId,
  placement,
}: {
  spaceId: string;
  userId: string;
  checklistItemId: string;
  parentType: ChecklistParentType;
  parentId: string;
  placement: Placement;
}): PublicChecklistItem {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: checklistItemById,
    args: { id: checklistItemId },
  });
  if (!current) throw new ResourceNotFoundError("Checklist item");
  requireParent(db, parentType, parentId);

  syncDispatch(
    db,
    updateItem({
      id: checklistItemId,
      item: {
        parentType,
        parentId,
        orderToken: resolveOrderToken({
          entities: parentItems(db, parentType, parentId, checklistItemId),
          placement,
        }),
      },
    }),
  );
  return getChecklistItem({ spaceId, userId, checklistItemId });
}

export function deleteChecklistItem({
  spaceId,
  userId,
  checklistItemId,
}: {
  spaceId: string;
  userId: string;
  checklistItemId: string;
}): void {
  const db = getSpaceDatabase(spaceId, userId);
  const item = selectSync(db, {
    selector: checklistItemById,
    args: { id: checklistItemId },
  });
  if (!item) throw new ResourceNotFoundError("Checklist item");
  syncDispatch(db, deleteItems({ ids: [checklistItemId] }));
}
