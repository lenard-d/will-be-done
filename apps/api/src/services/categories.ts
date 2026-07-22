import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  createCategory as createCategoryAction,
  deleteCategories,
  projectById,
  projectCategoryById,
  projectCategoriesByProjectId,
  updateCategory as updateCategoryAction,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
import { ConflictError, ResourceNotFoundError } from "./errors";
import {
  resolveCreatePosition,
  resolveOrderToken,
  type Placement,
} from "./placement";

export interface PublicProjectCategory {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
}

function toPublicProjectCategory({
  id,
  projectId,
  title,
  createdAt,
}: PublicProjectCategory): PublicProjectCategory {
  return { id, projectId, title, createdAt };
}

function getSpaceDatabase(spaceId: string, userId: string) {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  return getHyperDB(spaceDBConfig(spaceId)).db;
}

export function listProjectCategories({
  spaceId,
  projectId,
  userId,
}: {
  spaceId: string;
  projectId: string;
  userId: string;
}): PublicProjectCategory[] {
  const db = getSpaceDatabase(spaceId, userId);
  const project = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!project) throw new ResourceNotFoundError("Project");

  return selectSync(db, {
    selector: projectCategoriesByProjectId,
    args: { projectId },
  }).map(toPublicProjectCategory);
}

export function createProjectCategory({
  spaceId,
  projectId,
  userId,
  title,
  placement = { kind: "last" },
}: {
  spaceId: string;
  projectId: string;
  userId: string;
  title: string;
  placement?: Placement;
}): PublicProjectCategory {
  const db = getSpaceDatabase(spaceId, userId);
  const project = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!project) throw new ResourceNotFoundError("Project");

  const categories =
    placement.kind === "before" || placement.kind === "after"
      ? selectSync(db, {
          selector: projectCategoriesByProjectId,
          args: { projectId },
        })
      : [];
  return toPublicProjectCategory(
    syncDispatch(
      db,
      createCategoryAction({
        categoryDraft: { projectId, title },
        position: resolveCreatePosition({ entities: categories, placement }),
      }),
    ),
  );
}

export function updateProjectCategory({
  spaceId,
  categoryId,
  userId,
  updates,
}: {
  spaceId: string;
  categoryId: string;
  userId: string;
  updates: { title?: string };
}): PublicProjectCategory {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!current) throw new ResourceNotFoundError("Project category");

  syncDispatch(
    db,
    updateCategoryAction({
      categoryId,
      category: {
        ...(updates.title === undefined ? {} : { title: updates.title }),
      },
    }),
  );

  const updated = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!updated) throw new ResourceNotFoundError("Project category");
  return toPublicProjectCategory(updated);
}

export function moveProjectCategory({
  spaceId,
  categoryId,
  userId,
  projectId,
  placement,
}: {
  spaceId: string;
  categoryId: string;
  userId: string;
  projectId: string;
  placement: Placement;
}): PublicProjectCategory {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!current) throw new ResourceNotFoundError("Project category");
  const currentProject = selectSync(db, {
    selector: projectById,
    args: { id: current.projectId },
  });
  if (currentProject?.isInbox) {
    throw new ConflictError("Inbox category cannot be moved");
  }
  const destinationProject = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!destinationProject) throw new ResourceNotFoundError("Project");

  const categories = selectSync(db, {
    selector: projectCategoriesByProjectId,
    args: { projectId },
  }).filter((category) => category.id !== categoryId);
  syncDispatch(
    db,
    updateCategoryAction({
      categoryId,
      category: {
        projectId,
        orderToken: resolveOrderToken({ entities: categories, placement }),
      },
    }),
  );
  const updated = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!updated) throw new ResourceNotFoundError("Project category");
  return toPublicProjectCategory(updated);
}

export function deleteProjectCategory({
  spaceId,
  categoryId,
  userId,
}: {
  spaceId: string;
  categoryId: string;
  userId: string;
}): void {
  const db = getSpaceDatabase(spaceId, userId);
  const category = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!category) throw new ResourceNotFoundError("Project category");
  const project = selectSync(db, {
    selector: projectById,
    args: { id: category.projectId },
  });
  if (project?.isInbox) {
    throw new ConflictError("Inbox category cannot be deleted");
  }
  syncDispatch(db, deleteCategories({ ids: [categoryId] }));
}
