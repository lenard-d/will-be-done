import {
  action,
  deleteRows,
  defineTable,
  type ExtractSchema,
  insert,
  selectFrom,
  selector,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { uuidv7 } from "uuidv7";
import { registerUserSyncableTable } from "./syncMap";

export const spacesTableType = "space";

export const spacesTable = defineTable("spaces", {
  id: v.string(),
  type: v.literal(spacesTableType),
  name: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("byIds", ["id"]);
export type Space = ExtractSchema<typeof spacesTable>;

const getSpaceById = selector({
  name: "getSpaceById",
  args: { id: v.string() },
  handler: function* getSpaceById({ id }: {
    id: string;
  }) {
  const spaces = yield* selectFrom(spacesTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);
  return spaces[0] as Space | undefined;
}
});

const listSpaces = selector({
  name: "listSpaces",
  args: {},
  handler: function* listSpaces() {
  const spaces = yield* selectFrom(spacesTable, "byIds");
  return spaces as Space[];
}
});

const createSpace = action({
  name: "createSpace",
  args: { name: v.string() },
  handler: function* createSpace({ name }: {
    name: string;
  }) {
  const spaceId = uuidv7();
  const now = new Date().toISOString();
  const space: Space = {
    id: spaceId,
    type: spacesTableType,
    name,
    createdAt: now,
    updatedAt: now,
  };

  yield* insert(spacesTable, [space]);

  return space;
}
});

const updateSpace = action({
  name: "updateSpace",
  args: {
    id: v.string(),
    name: v.string(),
  },
  handler: function* updateSpace({ id, name }: {
    id: string;
    name: string;
  }) {
  const space = yield* getSpaceById({ id });
  if (!space) {
    return null as Space | null;
  }

  const updatedSpace: Space = {
    ...space,
    name,
    updatedAt: new Date().toISOString(),
  };

  yield* upsert(spacesTable, [updatedSpace]);

  return updatedSpace as Space | null;
}
});

const deleteSpace = action({
  name: "deleteSpace",
  args: { id: v.string() },
  handler: function* deleteSpace({ id }: {
    id: string;
  }) {
  const space = yield* getSpaceById({ id });
  if (!space) {
    return false;
  }

  yield* deleteRows(spacesTable, [id]);

  return true;
}
});

export const spaceSlice = {
  getSpaceById,
  listSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
};

registerUserSyncableTable(spacesTable, spacesTableType);
