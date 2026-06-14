import { selector, selectFrom, action, v } from "@will-be-done/hyperdb-lib";
import { dailyDateFormat, generateKeyPositionedBetween } from "./utils";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { createTask, taskById, taskType } from "./cardsTasks";
import { taskTemplateById } from "./cardsTaskTemplates";
import { dailyListAllTaskIds } from "./dailyLists";
import { defaultTask, Task, tasksTable } from "./cardsTasks";
import { TaskTemplate, taskTemplatesTable } from "./cardsTaskTemplates";
import { Project, projectsTable } from "./projects";
import { parse } from "date-fns";
import { ProjectCategory, projectCategoriesTable } from "./projectsCategories";
import { DailyList, dailyListsTable } from "./dailyLists";
import { TaskProjection, taskProjectionsTable } from "./dailyListsProjections";
import { stashProjectionsTable } from "./stashProjections";
import { CardWrapper } from "./cards";
import { hasChecklistItems } from "./checklistItems";

export type Card = Task | TaskTemplate;
export type CardForDisplay = {
  card: Card;
  category: ProjectCategory;
  cardWrapper: CardWrapper;
  project: Project;
  dailyList: DailyList | undefined;
  dateOfTask: Date | undefined;
  lastScheduleTime: Date | undefined;
  hasChecklist: boolean;
};

const taskValidator = v.object({
  type: v.literal(taskType),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  state: v.union(v.literal("todo"), v.literal("done")),
  projectCategoryId: v.string(),
  orderToken: v.string(),
  lastToggledAt: v.number(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
  createdAt: v.number(),
  templateId: v.union(v.string(), v.null()),
  templateDate: v.union(v.number(), v.null()),
});

const taskTemplateValidator = v.object({
  type: v.literal("template"),
  id: v.string(),
  title: v.string(),
  content: v.optional(v.string()),
  orderToken: v.string(),
  repeatRule: v.string(),
  repeatRuleDtStart: v.number(),
  createdAt: v.number(),
  lastGeneratedAt: v.number(),
  projectCategoryId: v.string(),
  nature: v.optional(
    v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
  ),
});

const taskProjectionValidator = v.object({
  type: v.literal("projection"),
  id: v.string(),
  orderToken: v.string(),
  dailyListId: v.string(),
  createdAt: v.number(),
});

const stashProjectionValidator = v.object({
  type: v.literal("stashProjection"),
  id: v.string(),
  orderToken: v.string(),
  createdAt: v.number(),
});

// TODO: check if all items renamed to card

export const firstProjectCategoryCard = selector({
  name: "firstProjectCategoryCard",
  args: { projectCategoryId: v.string() },
  handler: function* firstProjectCategoryCard({ projectCategoryId }: {
    projectCategoryId: string;
  }): Generator<unknown, Card, unknown> {
    const ids = yield* projectCategoryCardIds({ projectCategoryId });
    if (ids.length === 0) return defaultTask;

    return yield* projectCategoryCardByIdOrDefault({ id: ids[0] });
  }
});

export const lastProjectCategoryCard = selector({
  name: "lastProjectCategoryCard",
  args: { projectCategoryId: v.string() },
  handler: function* lastProjectCategoryCard({ projectCategoryId }: {
    projectCategoryId: string;
  }): Generator<unknown, Card, unknown> {
    const ids = yield* projectCategoryCardIds({ projectCategoryId });
    if (ids.length === 0) return defaultTask;

    return yield* projectCategoryCardByIdOrDefault({ id: ids[ids.length - 1] });
  }
});

export const projectCategoryCardIdsExceptDailies = selector({
  name: "projectCategoryCardIdsExceptDailies",
  args: {
    projectCategoryId: v.string(),
    exceptDailyListIds: v.array(v.string()),
  },
  handler: function* projectCategoryCardIdsExceptDailies({ projectCategoryId, exceptDailyListIds }: {
    projectCategoryId: string;
    exceptDailyListIds: string[];
  }): Generator<unknown, string[], unknown> {
    // TODO: use merge sort
    const exceptTaskIds = yield* dailyListAllTaskIds({ dailyListIds: exceptDailyListIds });
    const tasks = yield* selectFrom(
      tasksTable,
      "byCategoryIdOrderStates",
    ).where((q) =>
      q.eq("projectCategoryId", projectCategoryId).eq("state", "todo"),
    );

    const finalTasks = tasks.filter((task) => !exceptTaskIds.has(task.id));

    const templates = yield* selectFrom(
      taskTemplatesTable,
      "byCategoryIdOrderStates",
    ).where((q) => q.eq("projectCategoryId", projectCategoryId));

    const allCards = [...finalTasks, ...templates];

    return allCards
      .sort((a, b) => {
        if (a.orderToken > b.orderToken) {
          return 1;
        }
        if (a.orderToken < b.orderToken) {
          return -1;
        }

        return 0;
      })
      .map((card) => card.id);
  }
});

export const projectCategoryCards = selector({
  name: "projectCategoryCards",
  args: { projectCategoryId: v.string() },
  handler: function* projectCategoryCards({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
  // TODO: use merge sort
  const tasks = yield* selectFrom(tasksTable, "byCategoryIdOrderStates").where(
    (q) => q.eq("projectCategoryId", projectCategoryId).eq("state", "todo"),
  );

  const templates = yield* selectFrom(
    taskTemplatesTable,
    "byCategoryIdOrderStates",
  ).where((q) => q.eq("projectCategoryId", projectCategoryId));

  const allCards = [...tasks, ...templates];

  return allCards.sort((a, b) => {
    if (a.orderToken > b.orderToken) {
      return 1;
    }
    if (a.orderToken < b.orderToken) {
      return -1;
    }

    return 0;
  }) as (Task | TaskTemplate)[];
}
});

export const projectCategoryCardsForDisplay = selector({
  name: "projectCategoryCardsForDisplay",
  args: {
    cards: v.array(v.union(taskValidator, taskTemplateValidator)),
    cardWrappers: v.array(
      v.union(
        taskValidator,
        taskTemplateValidator,
        taskProjectionValidator,
        stashProjectionValidator,
      ),
    ),
  },
  handler: function* projectCategoryCardsForDisplay({ cards, cardWrappers }: {
    cards: Card[];
    cardWrappers: CardWrapper[];
  }): Generator<unknown, CardForDisplay[], unknown> {
    const categoryIds = [
      ...new Set(cards.map((card) => card.projectCategoryId)),
    ];
    const categories = categoryIds.length
      ? yield* selectFrom(projectCategoriesTable, "byId").where((q) =>
          categoryIds.map((id) => q.eq("id", id)),
        )
      : [];
    const categoryMap = new Map(
      (categories as ProjectCategory[]).map((category) => [
        category.id,
        category,
      ]),
    );

    const projectIds = [
      ...new Set((categories as ProjectCategory[]).map((c) => c.projectId)),
    ];
    const projects = projectIds.length
      ? yield* selectFrom(projectsTable, "byId").where((q) =>
          projectIds.map((id) => q.eq("id", id)),
        )
      : [];
    const projectMap = new Map(
      (projects as Project[]).map((project) => [project.id, project]),
    );

    const cardIds = cards.map((card) => card.id);
    const projections = cardIds.length
      ? yield* selectFrom(taskProjectionsTable, "byId").where((q) =>
          cardIds.map((id) => q.eq("id", id)),
        )
      : [];
    const projectionMap = new Map(
      (projections as TaskProjection[]).map((projection) => [
        projection.id,
        projection,
      ]),
    );

    const dailyListIds = [
      ...new Set(
        (projections as TaskProjection[]).map(
          (projection) => projection.dailyListId,
        ),
      ),
    ];
    const dailyLists = dailyListIds.length
      ? yield* selectFrom(dailyListsTable, "byId").where((q) =>
          dailyListIds.map((id) => q.eq("id", id)),
        )
      : [];
    const dailyListMap = new Map(
      (dailyLists as DailyList[]).map((dailyList) => [dailyList.id, dailyList]),
    );
    const wrapperMap = new Map(
      cardWrappers.map((wrapper) => [`${wrapper.type}:${wrapper.id}`, wrapper]),
    );

    const hasChecklistMap = new Map<string, boolean>();
    for (const c of cards) {
      const has = yield* hasChecklistItems({
        parentType: c.type,
        paretId: c.id,
      });
      hasChecklistMap.set(`${c.id}:${c.type}`, has);
    }

    return cards.map((card) => {
      const category = categoryMap.get(card.projectCategoryId);
      if (!category) throw new Error("failed to find project category");

      const project = projectMap.get(category.projectId);
      if (!project) throw new Error("failed to find project");

      const cardWrapper =
        wrapperMap.get(`${card.type}:${card.id}`) ||
        wrapperMap.get(`projection:${card.id}`);
      if (!cardWrapper) throw new Error("failed to find card wrapper");

      const projection = projectionMap.get(card.id);
      const dailyList = projection
        ? dailyListMap.get(projection.dailyListId)
        : undefined;
      const dateOfTask = dailyList
        ? parse(dailyList.date, dailyDateFormat, new Date())
        : undefined;

      return {
        card,
        category,
        project,
        cardWrapper,
        dailyList,
        dateOfTask,
        lastScheduleTime: dateOfTask,
        hasChecklist: hasChecklistMap.get(`${card.id}:${card.type}`) ?? false,
      };
    });
  }
});

export const projectCategoryCardsForDisplayChildren = selector({
  name: "projectCategoryCardsForDisplayChildren",
  args: { projectCategoryId: v.string() },
  handler: function* projectCategoryCardsForDisplayChildren({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
    const cards = yield* projectCategoryCards({ projectCategoryId });
    return yield* projectCategoryCardsForDisplay({
  cards,
  cardWrappers: cards,
});
  }
});

export const projectCategoryCardIdsWithTypes = selector({
  name: "projectCategoryCardIdsWithTypes",
  args: { projectCategoryId: v.string() },
  handler: function* projectCategoryCardIdsWithTypes({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
    return (yield* projectCategoryCards({ projectCategoryId })).map((card) => ({
      id: card.id,
      type: card.type as "task" | "template",
    }));
  }
});

export const projectCategoryCardIds = selector({
  name: "projectCategoryCardIds",
  args: { projectCategoryId: v.string() },
  handler: function* projectCategoryCardIds({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
  return (yield* projectCategoryCards({ projectCategoryId })).map(
    (card) => card.id,
  );
}
});

export const doneProjectCategoryCardIds = selector({
  name: "doneProjectCategoryCardIds",
  args: { projectCategoryId: v.string() },
  handler: function* doneProjectCategoryCardIds({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
    const tasks = yield* selectFrom(
      tasksTable,
      "byCategoryIdOrderStates",
    ).where((q) =>
      q.eq("projectCategoryId", projectCategoryId).eq("state", "done"),
    );

    return tasks
      .sort((a, b) => b.lastToggledAt - a.lastToggledAt)
      .map((p) => p.id);
  }
});

export const doneProjectCategoryCardsForDisplay = selector({
  name: "doneProjectCategoryCardsForDisplay",
  args: { projectCategoryId: v.string() },
  handler: function* doneProjectCategoryCardsForDisplay({ projectCategoryId }: {
    projectCategoryId: string;
  }) {
    const tasks = yield* selectFrom(
      tasksTable,
      "byCategoryIdOrderStates",
    ).where((q) =>
      q.eq("projectCategoryId", projectCategoryId).eq("state", "done"),
    );
    const cards = (tasks as Task[]).sort(
      (a, b) => b.lastToggledAt - a.lastToggledAt,
    );

    return yield* projectCategoryCardsForDisplay({
  cards,
  cardWrappers: cards,
});
  }
});

export const doneProjectCategoryCardIdsExceptDailies = selector({
  name: "doneProjectCategoryCardIdsExceptDailies",
  args: {
    projectCategoryId: v.string(),
    exceptDailyListIds: v.array(v.string()),
  },
  handler: function* doneProjectCategoryCardIdsExceptDailies({ projectCategoryId, exceptDailyListIds }: {
    projectCategoryId: string;
    exceptDailyListIds: string[];
  }): Generator<unknown, string[], unknown> {
    const exceptTaskIds = yield* dailyListAllTaskIds({ dailyListIds: exceptDailyListIds });

    const taskIds = yield* doneProjectCategoryCardIds({ projectCategoryId });

    return taskIds.filter((id) => !exceptTaskIds.has(id));
  }
});

export const projectCategoryCardById = selector({
  name: "projectCategoryCardById",
  args: { id: v.string() },
  handler: function* projectCategoryCardById({ id }: {
    id: string;
  }): Generator<unknown, Card | undefined, unknown> {
    const task = yield* taskById({ id });
    if (task) return task;

    const template = yield* taskTemplateById({ id });
    if (template) return template;

    return undefined;
  }
});

export const projectCategoryCardByIdOrDefault = selector({
  name: "projectCategoryCardByIdOrDefault",
  args: { id: v.string() },
  handler: function* projectCategoryCardByIdOrDefault({ id }: {
    id: string;
  }): Generator<unknown, Card, unknown> {
    return (yield* projectCategoryCardById({ id })) || defaultTask;
  }
});

export const projectCategoryCardSiblings = selector({
  name: "projectCategoryCardSiblings",
  args: { cardId: v.string() },
  handler: function* projectCategoryCardSiblings({ cardId }: {
    cardId: string;
  }): Generator<unknown, [Card | undefined, Card | undefined], unknown> {
    const card = yield* projectCategoryCardByIdOrDefault({ id: cardId });
    if (!card) return [undefined, undefined];

    const ids = yield* projectCategoryCardIds({ projectCategoryId: card.projectCategoryId });
    const index = ids.findIndex((id) => id === cardId);

    const beforeId = index > 0 ? ids[index - 1] : undefined;
    const afterId = index < ids.length - 1 ? ids[index + 1] : undefined;

    const before = beforeId
      ? yield* projectCategoryCardByIdOrDefault({ id: beforeId })
      : undefined;
    const after = afterId
      ? yield* projectCategoryCardByIdOrDefault({ id: afterId })
      : undefined;

    return [before, after];
  }
});

export const createSiblingTask = action({
  name: "createSiblingTask",
  args: {
    cardId: v.string(),
    position: v.union(v.literal("before"), v.literal("after")),
    taskParams: v.optional(
      v.object({
        type: v.optional(v.literal(taskType)),
        id: v.optional(v.string()),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
        projectCategoryId: v.optional(v.string()),
        orderToken: v.optional(v.string()),
        lastToggledAt: v.optional(v.number()),
        nature: v.optional(
          v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
        ),
        createdAt: v.optional(v.number()),
        templateId: v.optional(v.union(v.string(), v.null())),
        templateDate: v.optional(v.union(v.number(), v.null())),
      }),
    ),
  },
  handler: function* createSiblingTask({ cardId, position, taskParams }: {
    cardId: string;
    position: "before" | "after";
    taskParams?: Partial<Task>;
  }) {
  const card = yield* projectCategoryCardByIdOrDefault({ id: cardId });
  if (!card) throw new Error("Card not found");

  return yield* createTask({ task: {
    ...taskParams,
    projectCategoryId: card.projectCategoryId,
    orderToken: generateKeyPositionedBetween(
      card,
      yield* projectCategoryCardSiblings({ cardId }),
      position,
    ),
  } });
}
});

export const createTaskCardAfter = action({
  name: "createTaskCardAfter",
  args: {
    cardId: v.string(),
    taskParams: v.optional(
      v.object({
        type: v.optional(v.literal(taskType)),
        id: v.optional(v.string()),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        state: v.optional(v.union(v.literal("todo"), v.literal("done"))),
        projectCategoryId: v.optional(v.string()),
        orderToken: v.optional(v.string()),
        lastToggledAt: v.optional(v.number()),
        nature: v.optional(
          v.union(v.literal("red"), v.literal("green"), v.literal("unknown")),
        ),
        createdAt: v.optional(v.number()),
        templateId: v.optional(v.union(v.string(), v.null())),
        templateDate: v.optional(v.union(v.number(), v.null())),
      }),
    ),
  },
  handler: function* createTaskCardAfter({ cardId, taskParams }: {
    cardId: string;
    taskParams?: Partial<Task>;
  }) {
  const card = yield* projectCategoryCardByIdOrDefault({ id: cardId });
  if (!card) throw new Error("Card not found");

  const [, after] = yield* projectCategoryCardSiblings({ cardId });
  const orderToken = generateJitteredKeyBetween(
    card.orderToken,
    after?.orderToken || null,
  );

  return yield* createTask({ task: {
    ...taskParams,
    projectCategoryId: card.projectCategoryId,
    orderToken,
  } });
}
});
