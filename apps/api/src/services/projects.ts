import { selectSync } from "@will-be-done/hyperdb";
import { allProjects } from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";

export interface PublicProject {
  id: string;
  title: string;
  icon: string;
  isInbox: boolean;
  orderToken: string;
  createdAt: number;
}

export function listSpaceProjects({
  spaceId,
  userId,
}: {
  spaceId: string;
  userId: string;
}): PublicProject[] {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });

  const db = getHyperDB(spaceDBConfig(spaceId)).db;
  const projects = selectSync(db, { selector: allProjects, args: {} });

  return projects.map(
    ({ id, title, icon, isInbox, createdAt, orderToken }) => ({
      id,
      title,
      icon,
      isInbox,
      orderToken,
      createdAt,
    }),
  );
}
