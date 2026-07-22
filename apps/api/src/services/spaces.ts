import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  createSpace,
  deleteSpace,
  listSpaces,
} from "@will-be-done/slices/user";
import { userDBConfig } from "../db/configs";
import { getHyperDB } from "../db/db";

export interface PublicSpace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

function getUserDatabase(userId: string) {
  return getHyperDB(userDBConfig(userId)).db;
}

function toPublicSpace({
  id,
  name,
  createdAt,
  updatedAt,
}: PublicSpace): PublicSpace {
  return { id, name, createdAt, updatedAt };
}

export function listUserSpaces({ userId }: { userId: string }): PublicSpace[] {
  const spaces = selectSync(getUserDatabase(userId), {
    selector: listSpaces,
    args: {},
  });

  return spaces.map(toPublicSpace);
}

export function createUserSpace({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): PublicSpace {
  const space = syncDispatch(getUserDatabase(userId), createSpace({ name }));

  return toPublicSpace(space);
}

export function deleteUserSpace({
  userId,
  spaceId,
}: {
  userId: string;
  spaceId: string;
}): boolean {
  return syncDispatch(getUserDatabase(userId), deleteSpace({ id: spaceId }));
}
