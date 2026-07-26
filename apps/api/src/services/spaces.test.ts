import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { DB, execSync } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { spacesTable } from "@will-be-done/slices/user";
import * as databases from "../db/db";
import {
  createUserSpace,
  deleteUserSpace,
  listUserSpaces,
  updateUserSpace,
} from "./spaces";

describe("space service", () => {
  afterEach(() => {
    mock.restore();
  });

  test("creates, updates, lists, and deletes spaces in the user's database", () => {
    const userDB = new DB(new BptreeInmemDriver());
    execSync(userDB.loadTables([spacesTable]));
    spyOn(databases, "getHyperDB").mockImplementation(
      () =>
        ({ db: userDB }) as unknown as ReturnType<typeof databases.getHyperDB>,
    );

    const created = createUserSpace({ userId: "user-1", name: "Personal" });

    expect(created).toMatchObject({ name: "Personal" });
    expect(created).not.toHaveProperty("type");
    expect(listUserSpaces({ userId: "user-1" })).toEqual([created]);
    expect(
      updateUserSpace({
        userId: "user-1",
        spaceId: created.id,
        name: "Renamed",
      }),
    ).toMatchObject({ id: created.id, name: "Renamed" });
    expect(
      updateUserSpace({
        userId: "user-1",
        spaceId: "missing",
        name: "Missing",
      }),
    ).toBeNull();
    expect(deleteUserSpace({ userId: "user-1", spaceId: created.id })).toBe(
      true,
    );
    expect(listUserSpaces({ userId: "user-1" })).toEqual([]);
    expect(deleteUserSpace({ userId: "user-1", spaceId: created.id })).toBe(
      false,
    );
  });
});
