import { selectSync, syncDispatch } from "@will-be-done/hyperdb";
import {
  createProjectSection as createProjectSectionAction,
  deleteProjectSections,
  projectById,
  projectSectionById,
  projectSectionsByProjectId,
  updateProjectSection as updateProjectSectionAction,
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

export interface PublicProjectSection {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
}

function toPublicProjectSection({
  id,
  projectId,
  title,
  createdAt,
}: PublicProjectSection): PublicProjectSection {
  return { id, projectId, title, createdAt };
}

function getSpaceDatabase(spaceId: string, userId: string) {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  return getHyperDB(spaceDBConfig(spaceId)).db;
}

export function listProjectSections({
  spaceId,
  projectId,
  userId,
}: {
  spaceId: string;
  projectId: string;
  userId: string;
}): PublicProjectSection[] {
  const db = getSpaceDatabase(spaceId, userId);
  const project = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!project) throw new ResourceNotFoundError("Project");

  return selectSync(db, {
    selector: projectSectionsByProjectId,
    args: { projectId },
  }).map(toPublicProjectSection);
}

export function createProjectSection({
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
}): PublicProjectSection {
  const db = getSpaceDatabase(spaceId, userId);
  const project = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!project) throw new ResourceNotFoundError("Project");

  const sections =
    placement.kind === "before" || placement.kind === "after"
      ? selectSync(db, {
          selector: projectSectionsByProjectId,
          args: { projectId },
        })
      : [];
  return toPublicProjectSection(
    syncDispatch(
      db,
      createProjectSectionAction({
        sectionDraft: { projectId, title },
        position: resolveCreatePosition({ entities: sections, placement }),
      }),
    ),
  );
}

export function updateProjectSection({
  spaceId,
  sectionId,
  userId,
  updates,
}: {
  spaceId: string;
  sectionId: string;
  userId: string;
  updates: { title?: string };
}): PublicProjectSection {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!current) throw new ResourceNotFoundError("Project section");

  syncDispatch(
    db,
    updateProjectSectionAction({
      projectSectionId: sectionId,
      section: {
        ...(updates.title === undefined ? {} : { title: updates.title }),
      },
    }),
  );

  const updated = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!updated) throw new ResourceNotFoundError("Project section");
  return toPublicProjectSection(updated);
}

export function moveProjectSection({
  spaceId,
  sectionId,
  userId,
  projectId,
  placement,
}: {
  spaceId: string;
  sectionId: string;
  userId: string;
  projectId: string;
  placement: Placement;
}): PublicProjectSection {
  const db = getSpaceDatabase(spaceId, userId);
  const current = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!current) throw new ResourceNotFoundError("Project section");
  const currentProject = selectSync(db, {
    selector: projectById,
    args: { id: current.projectId },
  });
  if (currentProject?.isInbox) {
    throw new ConflictError("Inbox section cannot be moved");
  }
  const destinationProject = selectSync(db, {
    selector: projectById,
    args: { id: projectId },
  });
  if (!destinationProject) throw new ResourceNotFoundError("Project");

  const sections = selectSync(db, {
    selector: projectSectionsByProjectId,
    args: { projectId },
  }).filter((section) => section.id !== sectionId);
  syncDispatch(
    db,
    updateProjectSectionAction({
      projectSectionId: sectionId,
      section: {
        projectId,
        orderToken: resolveOrderToken({ entities: sections, placement }),
      },
    }),
  );
  const updated = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!updated) throw new ResourceNotFoundError("Project section");
  return toPublicProjectSection(updated);
}

export function deleteProjectSection({
  spaceId,
  sectionId,
  userId,
}: {
  spaceId: string;
  sectionId: string;
  userId: string;
}): void {
  const db = getSpaceDatabase(spaceId, userId);
  const section = selectSync(db, {
    selector: projectSectionById,
    args: { id: sectionId },
  });
  if (!section) throw new ResourceNotFoundError("Project section");
  const project = selectSync(db, {
    selector: projectById,
    args: { id: section.projectId },
  });
  if (project?.isInbox) {
    throw new ConflictError("Inbox section cannot be deleted");
  }
  syncDispatch(db, deleteProjectSections({ ids: [sectionId] }));
}
