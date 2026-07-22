import { selectSync } from "@will-be-done/hyperdb";
import {
  projectCategoryById,
  projectCategoryCards,
  projectCategoryTasksByState,
  type TaskTemplate,
} from "@will-be-done/slices/space";
import { getHyperDB } from "../db/db";
import { spaceDBConfig } from "../db/configs";
import { ensureDatabaseAccessOrCreate } from "./databaseAccess";
import { ResourceNotFoundError } from "./errors";
import { toPublicTask, type PublicTask } from "./tasks";

export interface PublicTaskTemplate {
  type: "template";
  id: string;
  title: string;
  content?: string;
  projectCategoryId: string;
  nature: "red" | "green" | "unknown";
  repeatRule: string;
  repeatRuleDtStart: number;
  createdAt: number;
  lastGeneratedAt: number;
}

export type PublicCard = PublicTask | PublicTaskTemplate;

function toPublicTaskTemplate(template: TaskTemplate): PublicTaskTemplate {
  return {
    type: "template",
    id: template.id,
    title: template.title,
    ...(template.content === undefined ? {} : { content: template.content }),
    projectCategoryId: template.projectCategoryId,
    nature: template.nature ?? "unknown",
    repeatRule: template.repeatRule,
    repeatRuleDtStart: template.repeatRuleDtStart,
    createdAt: template.createdAt,
    lastGeneratedAt: template.lastGeneratedAt,
  };
}

export function listCategoryCards({
  spaceId,
  categoryId,
  userId,
  taskState = "todo",
}: {
  spaceId: string;
  categoryId: string;
  userId: string;
  taskState?: "todo" | "done";
}): PublicCard[] {
  ensureDatabaseAccessOrCreate({ dbId: spaceId, dbType: "space", userId });
  const db = getHyperDB(spaceDBConfig(spaceId)).db;

  const category = selectSync(db, {
    selector: projectCategoryById,
    args: { id: categoryId },
  });
  if (!category) throw new ResourceNotFoundError("Project category");

  if (taskState === "done") {
    return selectSync(db, {
      selector: projectCategoryTasksByState,
      args: { projectCategoryId: categoryId, state: "done" },
    }).map(toPublicTask);
  }

  return selectSync(db, {
    selector: projectCategoryCards,
    args: { projectCategoryId: categoryId },
  }).map((card) =>
    card.type === "task" ? toPublicTask(card) : toPublicTaskTemplate(card),
  );
}
