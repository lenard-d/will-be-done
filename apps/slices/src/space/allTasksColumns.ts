import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { uuidv7 } from "uuidv7";
import { action, selector } from "../builders";
import { registerModelSlice } from "./maps";
import { normalizeTaskFiltersJson } from "./taskViewFilters";
import {
  type AllTasksColumn,
  allTasksColumnsTable,
  allTasksColumnType,
  possibleModelType,
} from "./tables";

export const defaultAllTasksColumnId = "all-tasks-column:default";

export const allTasksColumns = selector({
  name: "allTasksColumns",
  args: {},
  handler: function* allTasksColumns() {
    return yield* selectFrom(allTasksColumnsTable, "byOrder").order("asc");
  },
});

export const allTasksColumnById = selector({
  name: "allTasksColumnById",
  args: { id: v.string() },
  handler: function* allTasksColumnById({ id }) {
    return yield* selectFrom(allTasksColumnsTable, "byId")
      .where((query) => query.eq("id", id))
      .first();
  },
});

const requireColumn = selector({
  name: "requireAllTasksColumn",
  args: { id: v.string() },
  handler: function* requireColumn({ id }) {
    const column = yield* allTasksColumnById({ id });
    if (!column) throw new Error("All tasks column not found");
    return column;
  },
});

function columnTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Column title is required");
  return trimmed;
}

// A fixed identity prevents separate devices from creating duplicate defaults.
export const ensureAllTasksColumns = action({
  name: "ensureAllTasksColumns",
  args: { filtersJson: v.string() },
  handler: function* ensureAllTasksColumns({ filtersJson }) {
    const existing = (yield* allTasksColumns({}))[0];
    if (existing) return existing;
    const column: AllTasksColumn = {
      type: allTasksColumnType,
      id: defaultAllTasksColumnId,
      title: "Tasks",
      orderToken: "a0",
      createdAt: 0,
      filtersJson: normalizeTaskFiltersJson(filtersJson),
    };
    yield* insert(allTasksColumnsTable, [column]);
    return column;
  },
});

export const createAllTasksColumn = action({
  name: "createAllTasksColumn",
  args: {
    title: v.string(),
    filtersJson: v.string(),
    afterId: v.optional(v.string()),
  },
  handler: function* createAllTasksColumn({ title, filtersJson, afterId }) {
    const columns = yield* allTasksColumns({});
    const index =
      afterId === undefined
        ? columns.length - 1
        : columns.findIndex((column) => column.id === afterId);
    if (afterId !== undefined && index === -1) {
      throw new Error("All tasks column not found");
    }
    const column: AllTasksColumn = {
      type: allTasksColumnType,
      id: uuidv7(),
      title: columnTitle(title),
      orderToken: generateJitteredKeyBetween(
        columns[index]?.orderToken ?? null,
        columns[index + 1]?.orderToken ?? null,
      ),
      createdAt: Date.now(),
      filtersJson: normalizeTaskFiltersJson(filtersJson),
    };
    yield* insert(allTasksColumnsTable, [column]);
    return column;
  },
});

export const updateAllTasksColumn = action({
  name: "updateAllTasksColumn",
  args: {
    id: v.string(),
    title: v.optional(v.string()),
    filtersJson: v.optional(v.string()),
  },
  handler: function* updateAllTasksColumn({ id, title, filtersJson }) {
    const current = yield* requireColumn({ id });
    const column: AllTasksColumn = {
      ...current,
      title: title === undefined ? current.title : columnTitle(title),
      filtersJson:
        filtersJson === undefined
          ? current.filtersJson
          : normalizeTaskFiltersJson(filtersJson),
    };
    yield* upsert(allTasksColumnsTable, [column]);
    return column;
  },
});

export const moveAllTasksColumn = action({
  name: "moveAllTasksColumn",
  args: {
    id: v.string(),
    direction: v.union(v.literal("left"), v.literal("right")),
  },
  handler: function* moveAllTasksColumn({ id, direction }) {
    const current = yield* requireColumn({ id });
    const columns = yield* allTasksColumns({});
    const index = columns.findIndex((column) => column.id === id);
    const targetIndex = index + (direction === "left" ? -1 : 1);
    if (targetIndex < 0 || targetIndex >= columns.length) return current;
    const withoutCurrent = columns.filter((column) => column.id !== id);
    const column: AllTasksColumn = {
      ...current,
      orderToken: generateJitteredKeyBetween(
        withoutCurrent[targetIndex - 1]?.orderToken ?? null,
        withoutCurrent[targetIndex]?.orderToken ?? null,
      ),
    };
    yield* upsert(allTasksColumnsTable, [column]);
    return column;
  },
});

export const deleteAllTasksColumn = action({
  name: "deleteAllTasksColumn",
  args: { id: v.string() },
  handler: function* deleteAllTasksColumn({ id }) {
    yield* requireColumn({ id });
    if ((yield* allTasksColumns({})).length <= 1) {
      throw new Error("The final All tasks column cannot be deleted");
    }
    yield* deleteRows(allTasksColumnsTable, [id]);
  },
});

const deleteColumns = action({
  name: "deleteAllTasksColumns",
  args: { ids: v.array(v.string()) },
  handler: function* deleteColumns({ ids }) {
    for (const id of ids) yield* deleteAllTasksColumn({ id });
  },
});

const cannotDrop = selector({
  name: "allTasksColumnCannotDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* cannotDrop(_args) {
    return false;
  },
});

const noDrop = action({
  name: "allTasksColumnNoDrop",
  args: {
    id: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* noDrop(_args) {},
});

registerModelSlice(
  {
    byId: allTasksColumnById,
    delete: deleteColumns,
    canDrop: cannotDrop,
    handleDrop: noDrop,
  },
  allTasksColumnsTable,
  allTasksColumnType,
);
