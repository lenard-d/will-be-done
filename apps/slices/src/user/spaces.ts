import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { action, selector } from "../builders";
import { uuidv7 } from "uuidv7";
import { registerUserSyncableTable } from "./syncMap";
import { spacesTable, spacesTableType, type Space } from "./tables";

export { spacesTable, spacesTableType, type Space } from "./tables";

export const getSpaceById = selector({
  name: "getSpaceById",
  args: { id: v.string() },
  handler: function* getSpaceById({ id }) {
    const spaces = yield* selectFrom(spacesTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);
    return spaces[0] as Space | undefined;
  },
});

export const listSpaces = selector({
  name: "listSpaces",
  args: {},
  handler: function* listSpaces() {
    const spaces = yield* selectFrom(spacesTable, "byIds");
    return spaces as Space[];
  },
});

export const createSpace = action({
  name: "createSpace",
  args: { name: v.string() },
  handler: function* createSpace({ name }) {
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
  },
});

export const updateSpace = action({
  name: "updateSpace",
  args: {
    id: v.string(),
    name: v.string(),
  },
  handler: function* updateSpace({ id, name }) {
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
  },
});

export const deleteSpace = action({
  name: "deleteSpace",
  args: { id: v.string() },
  handler: function* deleteSpace({ id }) {
    const space = yield* getSpaceById({ id });
    if (!space) {
      return false;
    }

    yield* deleteRows(spacesTable, [id]);

    return true;
  },
});

registerUserSyncableTable(spacesTable, spacesTableType);
