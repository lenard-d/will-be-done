import { isObjectType, shouldNeverHappen } from "../utils";
import {
  action,
  deleteRows,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import { appById } from "./app";
import { AnyModelType, registerModelSlice } from "./maps";
import { registerSpaceSyncableTable } from "./syncMap";
import { checklistItemType, checklistItemsTable } from "./tables";

export { checklistItemType, checklistItemsTable };

const taskParentType = "task";
const taskTemplateParentType = "template";
export type ChecklistParentType =
  | typeof taskParentType
  | typeof taskTemplateParentType;
export type ChecklistItemState = "todo" | "done";

const checklistParentTypeValidator = v.union(
  v.literal(taskParentType),
  v.literal(taskTemplateParentType),
);

export type ChecklistItem = ExtractSchema<typeof checklistItemsTable>;

export const isChecklistItem = isObjectType<ChecklistItem>(checklistItemType);

export const defaultChecklistItem: ChecklistItem = {
  type: checklistItemType,
  id: "default-checklist-item-id",
  parentId: "default-parent-id",
  parentType: taskParentType,
  orderToken: "",
  state: "todo",
  content: "",
  createdAt: 0,
  checkedAt: null,
};
registerSpaceSyncableTable(checklistItemsTable, checklistItemType);

function isChecklistParentType(
  modelType: AnyModelType,
): modelType is ChecklistParentType {
  return modelType === taskParentType || modelType === taskTemplateParentType;
}

export const hasChecklistItems = selector({
  name: "hasChecklistItem",
  args: {
    parentType: checklistParentTypeValidator,
    paretId: v.string(),
  },
  handler: function* hasChecklistItem({ parentType, paretId }: {
    parentType: ChecklistParentType;
    paretId: string;
  }) {
  return (
    (yield* selectFrom(checklistItemsTable, "byParentOrder")
      .where((q) => q.eq("parentId", paretId).eq("parentType", parentType))
      .first()) !== undefined
  );
}
});

export const checklistItemById = selector({
  name: "checklistItemById",
  args: { id: v.string() },
  handler: function* checklistItemById({ id }: {
    id: string;
  }) {
  const items = yield* selectFrom(checklistItemsTable, "byId")
    .where((q) => q.eq("id", id))
    .limit(1);

  return items[0] as ChecklistItem | undefined;
}
});

export const checklistItemByIdOrDefault = selector({
  name: "checklistItemByIdOrDefault",
  args: { id: v.string() },
  handler: function* checklistItemByIdOrDefault({ id }: {
    id: string;
  }) {
    return (yield* checklistItemById({ id })) || defaultChecklistItem;
  }
});

export const checklistItemChildren = selector({
  name: "checklistItemChildren",
  args: {
    parentId: v.string(),
    parentType: checklistParentTypeValidator,
  },
  handler: function* checklistItemChildren({ parentId, parentType }: {
    parentId: string;
    parentType: ChecklistParentType;
  }) {
  return yield* selectFrom(checklistItemsTable, "byParentOrder").where((q) =>
    q.eq("parentType", parentType).eq("parentId", parentId),
  );
}
});

export const checklistItemChildrenIds = selector({
  name: "checklistItemChildrenIds",
  args: {
    parentId: v.string(),
    parentType: checklistParentTypeValidator,
  },
  handler: function* checklistItemChildrenIds({ parentId, parentType }: {
    parentId: string;
    parentType: ChecklistParentType;
  }) {
    return (yield* checklistItemChildren({
  parentId,
  parentType,
})).map(
      (item) => item.id,
    );
  }
});

export const allChecklistItems = selector({
  name: "allChecklistItems",
  args: {},
  handler: function* allChecklistItems() {
  return yield* selectFrom(checklistItemsTable, "byIds");
}
});

export const checklistItemSiblings = selector({
  name: "checklistItemSiblings",
  args: { itemId: v.string() },
  handler: function* checklistItemSiblings({ itemId }: {
    itemId: string;
  }): Generator<
  unknown,
  [ChecklistItem | undefined, ChecklistItem | undefined],
  unknown
> {
  const item = yield* checklistItemById({ id: itemId });
  if (!item) return [undefined, undefined];

  const items = yield* checklistItemChildren({
  parentId: item.parentId,
  parentType: item.parentType,
});
  const index = items.findIndex((child) => child.id === itemId);

  return [
    index > 0 ? items[index - 1] : undefined,
    index >= 0 && index < items.length - 1 ? items[index + 1] : undefined,
  ];
}
});

export const checklistItemCanDrop = selector({
  name: "checklistItemCanDrop",
  args: {
    itemId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* checklistItemCanDrop({ itemId, dropId, dropModelType }: {
    itemId: string;
    dropId: string;
    dropModelType: AnyModelType;
  }) {
  if (dropModelType !== checklistItemType) return false;
  if (itemId === dropId) return false;

  const target = yield* checklistItemById({ id: itemId });
  if (!target) return false;

  const dropped = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  return !!dropped && isChecklistItem(dropped);
}
});

export const createItem = action({
  name: "createItem",
  args: {
    item: v.object({
      type: v.optional(v.literal(checklistItemType)),
      id: v.optional(v.string()),
      parentId: v.string(),
      parentType: v.union(v.literal(taskParentType), v.literal(taskTemplateParentType)),
      orderToken: v.optional(v.string()),
      state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
      content: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      checkedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* createItem({ item }: {
    item: (Partial<ChecklistItem> & {
    parentId: string;
    parentType: ChecklistParentType;
  });
  }) {
  const id = item.id || uuidv7();
  const now = Date.now();

  let orderToken = item.orderToken;
  if (!orderToken) {
    const currentItems = yield* checklistItemChildren({
  parentId: item.parentId,
  parentType: item.parentType,
});
    orderToken = generateJitteredKeyBetween(
      currentItems[currentItems.length - 1]?.orderToken || null,
      null,
    );
  }

  const newItem: ChecklistItem = {
    type: checklistItemType,
    id,
    state: "todo",
    content: "",
    createdAt: now,
    checkedAt: null,
    ...item,
    parentId: item.parentId,
    parentType: item.parentType,
    orderToken,
  };

  yield* insert(checklistItemsTable, [newItem]);
  return newItem;
}
});

export const createItemAfter = action({
  name: "createItemAfter",
  args: {
    itemId: v.string(),
    item: v.optional(
      v.object({
        type: v.optional(v.literal(checklistItemType)),
        id: v.optional(v.string()),
        parentId: v.optional(v.string()),
        parentType: v.optional(
          v.union(v.literal(taskParentType), v.literal(taskTemplateParentType)),
        ),
        orderToken: v.optional(v.string()),
        state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
        content: v.optional(v.string()),
        createdAt: v.optional(v.number()),
        checkedAt: v.optional(v.union(v.number(), v.null())),
      }),
    ),
  },
  handler: function* createItemAfter({ itemId, item }: {
    itemId: string;
    item?: Partial<ChecklistItem>;
  }) {
  const currentItem = yield* checklistItemById({ id: itemId });
  if (!currentItem) throw new Error("Checklist item not found");

  const [, after] = yield* checklistItemSiblings({ itemId });

  return yield* createItem({ item: {
    ...item,
    parentId: currentItem.parentId,
    parentType: currentItem.parentType,
    orderToken: generateJitteredKeyBetween(
      currentItem.orderToken,
      after?.orderToken || null,
    ),
  } });
}
});

export const updateItem = action({
  name: "updateItem",
  args: {
    id: v.string(),
    item: v.object({
      type: v.optional(v.literal(checklistItemType)),
      id: v.optional(v.string()),
      parentId: v.optional(v.string()),
      parentType: v.optional(
        v.union(v.literal(taskParentType), v.literal(taskTemplateParentType)),
      ),
      orderToken: v.optional(v.string()),
      state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
      content: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      checkedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: function* updateItem({ id, item }: {
    id: string;
    item: Partial<ChecklistItem>;
  }) {
  const itemInState = yield* checklistItemById({ id });
  if (!itemInState) throw new Error("Checklist item not found");

  yield* upsert(checklistItemsTable, [{ ...itemInState, ...item }]);
}
});

export const updateChecklistItemContent = action({
  name: "updateChecklistItemContent",
  args: {
    id: v.string(),
    content: v.string(),
  },
  handler: function* updateChecklistItemContent({ id, content }: {
    id: string;
    content: string;
  }) {
    yield* updateItem({
  id,
  item: { content },
});
  }
});

export const toggleChecklistItemState = action({
  name: "toggleChecklistItemState",
  args: { id: v.string() },
  handler: function* toggleChecklistItemState({ id }: {
    id: string;
  }) {
    const item = yield* checklistItemById({ id });
    if (!item) throw new Error("Checklist item not found");

    const state = item.state === "todo" ? "done" : "todo";
    let orderToken = item.orderToken;

    if (state === "done") {
      const items = (yield* checklistItemChildren({
  parentId: item.parentId,
  parentType: item.parentType,
})).filter((child) => child.id !== id);
      const firstDoneIndex = items.findIndex((child) => child.state === "done");

      if (firstDoneIndex === -1) {
        orderToken = generateJitteredKeyBetween(
          items[items.length - 1]?.orderToken || null,
          null,
        );
      } else {
        orderToken = generateJitteredKeyBetween(
          items[firstDoneIndex - 1]?.orderToken || null,
          items[firstDoneIndex].orderToken,
        );
      }
    }

    yield* upsert(checklistItemsTable, [
      {
        ...item,
        state,
        checkedAt: state === "done" ? Date.now() : null,
        orderToken,
      },
    ]);
  }
});

export const deleteItems = action({
  name: "deleteItems",
  args: { ids: v.array(v.string()) },
  handler: function* deleteItems({ ids }: {
    ids: string[];
  }) {
  yield* deleteRows(checklistItemsTable, ids);
}
});

export const deleteForParents = action({
  name: "deleteForParents",
  args: {
    parentIds: v.array(v.string()),
    parentType: checklistParentTypeValidator,
  },
  handler: function* deleteForParents({ parentIds, parentType }: {
    parentIds: string[];
    parentType: ChecklistParentType;
  }) {
  const ids: string[] = [];
  for (const parentId of parentIds) {
    ids.push(...(yield* checklistItemChildrenIds({
  parentId,
  parentType,
})));
  }

  if (ids.length) {
    yield* deleteItems({ ids });
  }
}
});

export const copyItems = action({
  name: "copyItems",
  args: {
    fromParentId: v.string(),
    fromParentType: checklistParentTypeValidator,
    toParentId: v.string(),
    toParentType: checklistParentTypeValidator,
  },
  handler: function* copyItems({ fromParentId, fromParentType, toParentId, toParentType }: {
    fromParentId: string;
    fromParentType: ChecklistParentType;
    toParentId: string;
    toParentType: ChecklistParentType;
  }) {
  const sourceItems = yield* checklistItemChildren({
  parentId: fromParentId,
  parentType: fromParentType,
});
  const now = Date.now();
  const copiedItems = sourceItems.map((item) => ({
    ...item,
    id: uuidv7(),
    parentId: toParentId,
    parentType: toParentType,
    state: "todo" as const,
    createdAt: now,
    checkedAt: null,
  }));

  if (copiedItems.length) {
    yield* insert(checklistItemsTable, copiedItems);
  }

  return copiedItems;
}
});

export const moveToParent = action({
  name: "moveToParent",
  args: {
    itemId: v.string(),
    parentId: v.string(),
    parentType: checklistParentTypeValidator,
    position: v.union(v.literal("append"), v.literal("prepend")),
  },
  handler: function* moveToParent({ itemId, parentId, parentType, position }: {
    itemId: string;
    parentId: string;
    parentType: ChecklistParentType;
    position?: "append" | "prepend";
  }) {
  const item = yield* checklistItemById({ id: itemId });
  if (!item) return;

  const items = (yield* checklistItemChildren({
  parentId,
  parentType,
})).filter(
    (child) => child.id !== itemId,
  );
  const orderToken =
    position === "prepend"
      ? generateJitteredKeyBetween(null, items[0]?.orderToken || null)
      : generateJitteredKeyBetween(
          items[items.length - 1]?.orderToken || null,
          null,
        );

  yield* updateItem({
  id: itemId,
  item: { parentId, parentType, orderToken },
});
}
});

export const checklistItemHandleDrop = action({
  name: "checklistItemHandleDrop",
  args: {
    itemId: v.string(),
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* checklistItemHandleDrop({ itemId, dropId, dropModelType, edge }: {
    itemId: string;
    dropId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }) {
  if (!(yield* checklistItemCanDrop({
  itemId,
  dropId,
  dropModelType,
}))) return;

  const target = yield* checklistItemById({ id: itemId });
  if (!target) return shouldNeverHappen("checklist target not found");

  const dropped = yield* appById({
  id: dropId,
  modelType: dropModelType,
});
  if (!dropped || !isChecklistItem(dropped)) {
    return shouldNeverHappen("checklist drop item not found");
  }

  const [before, after] = yield* checklistItemSiblings({ itemId });
  const orderToken =
    edge === "top"
      ? generateJitteredKeyBetween(
          before?.orderToken || null,
          target.orderToken,
        )
      : generateJitteredKeyBetween(
          target.orderToken,
          after?.orderToken || null,
        );

  yield* updateItem({
  id: dropped.id,
  item: {
    parentId: target.parentId,
    parentType: target.parentType,
    orderToken,
  },
});
}
});

export const checklistItemCanDropOnParent = selector({
  name: "checklistItemCanDropOnParent",
  args: {
    parentId: v.string(),
    parentType: checklistParentTypeValidator,
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
  },
  handler: function* checklistItemCanDropOnParent({ parentId, parentType, dropId, dropModelType }: {
    parentId: string;
    parentType: ChecklistParentType;
    dropId: string;
    dropModelType: AnyModelType;
  }) {
    if (!isChecklistParentType(parentType)) return false;
    if (dropModelType !== checklistItemType) return false;

    const parent = yield* appById({
  id: parentId,
  modelType: parentType,
});
    const dropped = yield* appById({
  id: dropId,
  modelType: dropModelType,
});

    return !!parent && isChecklistItem(dropped);
  }
});

export const checklistItemHandleDropOnParent = action({
  name: "checklistItemHandleDropOnParent",
  args: {
    parentId: v.string(),
    parentType: checklistParentTypeValidator,
    dropId: v.string(),
    dropModelType: v.union(v.literal("task"), v.literal("template"), v.literal("project"), v.literal("dailyList"), v.literal("projectCategory"), v.literal("projection"), v.literal("stashProjection"), v.literal("checklistItem"), v.literal("stash")),
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* checklistItemHandleDropOnParent({ parentId, parentType, dropId, dropModelType, edge }: {
    parentId: string;
    parentType: ChecklistParentType;
    dropId: string;
    dropModelType: AnyModelType;
    edge: "top" | "bottom";
  }) {
    if (
      !(yield* checklistItemCanDropOnParent({
  parentId,
  parentType,
  dropId,
  dropModelType,
}))
    ) {
      return;
    }

    yield* moveToParent({
  itemId: dropId,
  parentId,
  parentType,
  position: edge === "top" ? "prepend" : "append",
});
  }
});

const checklistItemsSlice = {
  byId: checklistItemById,
  checklistItemByIdOrDefault,
  checklistItemChildren,
  checklistItemChildrenIds,
  allChecklistItems,
  checklistItemSiblings,
  canDrop: checklistItemCanDrop,
  createItem,
  createItemAfter,
  update: updateItem,
  toggleChecklistItemState,
  delete: deleteItems,
  deleteItems,
  deleteForParents,
  copyItems,
  moveToParent,
  handleDrop: checklistItemHandleDrop,
  checklistItemCanDropOnParent,
  checklistItemHandleDropOnParent,
};

registerModelSlice(checklistItemsSlice, checklistItemsTable, checklistItemType);
