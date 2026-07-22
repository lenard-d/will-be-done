import { selectSync, type DB, type HyperDB } from "@will-be-done/hyperdb";
import { allProjects } from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";

export interface PublicProject {
  id: string;
  title: string;
  icon: string;
  isInbox: boolean;
  createdAt: number;
}

export interface ListSpaceProjectsDependencies {
  mainDB?: DB;
  getSpaceDatabase?: (spaceId: string) => HyperDB;
}

export function listSpaceProjects(
  {
    spaceId,
    userId,
  }: {
    spaceId: string;
    userId: string;
  },
  dependencies: ListSpaceProjectsDependencies = {},
): PublicProject[] {
  ensureDatabaseAccessOrCreate(
    { dbId: spaceId, dbType: "space", userId },
    dependencies.mainDB,
  );

  const db =
    dependencies.getSpaceDatabase?.(spaceId) ??
    getHyperDB(spaceDBConfig(spaceId)).db;
  const projects = selectSync(db, { selector: allProjects, args: {} });

  return projects.map(({ id, title, icon, isInbox, createdAt }) => ({
    id,
    title,
    icon,
    isInbox,
    createdAt,
  }));
}
