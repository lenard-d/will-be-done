import { selectSync } from "@will-be-done/hyperdb";
import {
  projectSectionById,
  projectSectionItems,
  type Item,
} from "@will-be-done/slices/space";
import { getSpaceDatabase } from "./databaseAccess";
import { ResourceNotFoundError } from "./errors";

type SpaceDatabase = ReturnType<typeof getSpaceDatabase>;

export function requireSection(db: SpaceDatabase, sectionId: string) {
  const section = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!section) throw new ResourceNotFoundError("Project section");
  return section;
}

export function itemsInSection(
  db: SpaceDatabase,
  sectionId: string,
  excludedId?: string,
): Item[] {
  return selectSync(db, {
    selector: projectSectionItems,
    args: { projectSectionId: sectionId },
  }).filter((item) => item.id !== excludedId);
}
