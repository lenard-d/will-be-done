import {
  deleteRows,
  insert,
  selectFrom,
  upsert,
  v,
} from "@will-be-done/hyperdb-lib";
import { action, selector } from "../builders";
import {
  generateOrderTokenPositioned,
  normalizeOrderPosition,
  orderPositionArg,
} from "./utils";
import { registerModelSlice } from "./maps";
import { uuidv7 } from "uuidv7";
import { appById } from "./app";
import { deleteCardsByIds } from "./cards";
import {
  doneProjectCategoryCardIds,
  firstProjectCategoryCard,
  lastProjectCategoryCard,
  projectCategoryCardByIdOrDefault,
  projectCategoryCardIds,
} from "./projectsCategoriesCards";
import { projectById, projectByIdOrDefault } from "./projects";
import { createTask, taskById, updateTask } from "./cardsTasks";
import { updateTemplate } from "./cardsTaskTemplates";
import { defaultProject } from "./projects";
import { noop } from "@will-be-done/hyperdb-lib";
import { generateJitteredKeyBetween } from "fractional-indexing-jittered";
import { genUUIDV5 } from "../traits";
import {
  projectCategoryType,
  projectCategoriesTable,
  ProjectCategory,
  tasksTable,
  Task,
  possibleModelType,
  Project,
  isTask,
  isTaskTemplate,
  isTaskProjection,
} from "./tables";

export const defaultProjectCategory: ProjectCategory = {
  type: projectCategoryType,
  id: "abeee7aa-8bf4-4a5f-9167-ce42ad6187b6",
  title: "",
  projectId: "",
  orderToken: "",
  createdAt: 0,
};

export const projectCategoryById = selector({
  name: "projectCategoryById",
  args: { id: v.string() },
  handler: function* projectCategoryById({ id }) {
    const tasks = yield* selectFrom(projectCategoriesTable, "byId")
      .where((q) => q.eq("id", id))
      .limit(1);

    return tasks[0] as ProjectCategory | undefined;
  },
});

export const projectCategoryByIdOrDefault = selector({
  name: "projectCategoryByIdOrDefault",
  args: { id: v.string() },
  handler: function* projectCategoryByIdOrDefault({ id }) {
    return (yield* projectCategoryById({ id })) || defaultProjectCategory;
  },
});

export const allProjectCategories = selector({
  name: "allProjectCategories",
  args: {},
  handler: function* allProjectCategories() {
    const tasks = yield* selectFrom(
      projectCategoriesTable,
      "byProjectIdOrderToken",
    );
    return tasks;
  },
});

export const inboxCategoryId = selector({
  name: "inboxCategoryId",
  args: {},
  handler: function* inboxCategoryId() {
    return yield* genUUIDV5(projectCategoryType, "inbox");
  },
});

export const projectCategoriesByProjectIds = selector({
  name: "projectCategoriesByProjectIds",
  args: { projectIds: v.array(v.string()) },
  handler: function* projectCategoriesByProjectIds({ projectIds }) {
    const categories = yield* selectFrom(
      projectCategoriesTable,
      "byProjectIdOrderToken",
    ).where((q) => projectIds.map((id) => q.eq("projectId", id)));
    return categories;
  },
});

export const projectCategoriesByProjectId = selector({
  name: "projectCategoriesByProjectId",
  args: { projectId: v.string() },
  handler: function* projectCategoriesByProjectId({ projectId }) {
    return yield* projectCategoriesByProjectIds({ projectIds: [projectId] });
  },
});

export const projectOfCategory = selector({
  name: "projectOfCategory",
  args: { categoryId: v.string() },
  handler: function* projectOfCategory({
    categoryId,
  }): Generator<unknown, Project | undefined, unknown> {
    const category = yield* projectCategoryById({ id: categoryId });
    if (!category) return undefined;

    return yield* projectById({ id: category.projectId });
  },
});

export const projectOfCategoryOrDefault = selector({
  name: "projectOfCategoryOrDefault",
  args: { categoryId: v.string() },
  handler: function* projectOfCategoryOrDefault({
    categoryId,
  }): Generator<unknown, Project, unknown> {
    const category = yield* projectCategoryById({ id: categoryId });
    if (!category) return defaultProject;

    return yield* projectByIdOrDefault({ id: category.projectId });
  },
});

export const firstProjectCategoryChild = selector({
  name: "firstProjectCategoryChild",
  args: { projectId: v.string() },
  handler: function* firstProjectCategoryChild({ projectId }) {
    return (yield* projectCategoriesByProjectId({ projectId }))[0] as
      | ProjectCategory
      | undefined;
  },
});

export const lastProjectCategoryChild = selector({
  name: "lastProjectCategoryChild",
  args: { projectId: v.string() },
  handler: function* lastProjectCategoryChild({ projectId }) {
    const result = yield* projectCategoriesByProjectId({ projectId });
    if (result.length === 0) return undefined as ProjectCategory | undefined;

    return result[result.length - 1] as ProjectCategory | undefined;
  },
});

export const updateCategory = action({
  name: "updateCategory",
  args: {
    categoryId: v.string(),
    category: v.partial(projectCategoriesTable.v()),
  },
  handler: function* updateCategory({
    categoryId,
    category,
  }): Generator<unknown, void, unknown> {
    const categoryInState = yield* projectCategoryById({ id: categoryId });
    if (!categoryInState) throw new Error("Category not found");

    yield* upsert(projectCategoriesTable, [
      { ...categoryInState, ...category },
    ]);
  },
});

export const projectCategorySiblings = selector({
  name: "projectCategorySiblings",
  args: { categoryId: v.string() },
  handler: function* projectCategorySiblings({ categoryId }) {
    const item = yield* projectCategoryById({ id: categoryId });
    if (!item)
      return [undefined, undefined] as [
        ProjectCategory | undefined,
        ProjectCategory | undefined,
      ];

    const sortedProjectCategories = yield* selectFrom(
      projectCategoriesTable,
      "byProjectIdOrderToken",
    ).where((q) => q.eq("projectId", item.projectId));

    const index = sortedProjectCategories.findIndex((p) => p.id === categoryId);

    const beforeId =
      index > 0 ? sortedProjectCategories[index - 1].id : undefined;
    const afterId =
      index < sortedProjectCategories.length - 1
        ? sortedProjectCategories[index + 1].id
        : undefined;

    const before = beforeId
      ? yield* projectCategoryByIdOrDefault({ id: beforeId })
      : undefined;
    const after = afterId
      ? yield* projectCategoryByIdOrDefault({ id: afterId })
      : undefined;

    return [before, after] as [
      ProjectCategory | undefined,
      ProjectCategory | undefined,
    ];
  },
});

export const moveLeft = action({
  name: "moveLeft",
  args: { categoryId: v.string() },
  handler: function* moveLeft({
    categoryId,
  }): Generator<unknown, void, unknown> {
    const [up] = yield* projectCategorySiblings({ categoryId });
    const [up2] = up
      ? yield* projectCategorySiblings({ categoryId: up?.id })
      : [undefined, undefined];

    if (!up) return;

    yield* updateCategory({
      categoryId,
      category: {
        orderToken: generateJitteredKeyBetween(
          up2?.orderToken || null,
          up.orderToken,
        ),
      },
    });
  },
});

export const moveRight = action({
  name: "moveRight",
  args: { categoryId: v.string() },
  handler: function* moveRight({
    categoryId,
  }): Generator<unknown, void, unknown> {
    const [_up, down] = yield* projectCategorySiblings({ categoryId });
    const [_up2, down2] = down
      ? yield* projectCategorySiblings({ categoryId: down?.id })
      : [undefined, undefined];

    if (!down) return;

    yield* updateCategory({
      categoryId,
      category: {
        orderToken: generateJitteredKeyBetween(
          down.orderToken,
          down2?.orderToken || null,
        ),
      },
    });
  },
});

export const createCategory = action({
  name: "createCategory",
  args: {
    categoryDraft: v.required(v.partial(projectCategoriesTable.v()), [
      "title",
      "projectId",
    ]),
    position: orderPositionArg,
  },
  handler: function* createCategory({
    categoryDraft,
    position,
  }): Generator<unknown, ProjectCategory, unknown> {
    const orderToken = yield* generateOrderTokenPositioned(
      categoryDraft.projectId,
      {
        firstChild: (projectId) => firstProjectCategoryChild({ projectId }),
        lastChild: (projectId) => lastProjectCategoryChild({ projectId }),
      },
      normalizeOrderPosition(position),
    );

    const id = categoryDraft.id || uuidv7();

    const category: ProjectCategory = {
      type: projectCategoryType,
      id,
      title: categoryDraft.title,
      projectId: categoryDraft.projectId,
      orderToken: orderToken,
      createdAt: Date.now(),
    };

    yield* insert(projectCategoriesTable, [category]);

    return category;
  },
});

export const createProjectCategoryTask = action({
  name: "createProjectCategoryTask",
  args: {
    categoryId: v.string(),
    position: orderPositionArg,
    taskAttrs: v.optional(v.partial(tasksTable.v())),
  },
  handler: function* createProjectCategoryTask({
    categoryId,
    position,
    taskAttrs,
  }): Generator<unknown, Task, unknown> {
    const orderToken = yield* generateOrderTokenPositioned(
      categoryId,
      {
        firstChild: (projectCategoryId) =>
          firstProjectCategoryCard({ projectCategoryId }),
        lastChild: (projectCategoryId) =>
          lastProjectCategoryCard({ projectCategoryId }),
      },
      normalizeOrderPosition(position),
    );

    return yield* createTask({
      task: {
        ...taskAttrs,
        orderToken: orderToken,
        projectCategoryId: categoryId,
      },
    });
  },
});

export const deleteCategories = action({
  name: "deleteCategories",
  args: { ids: v.array(v.string()) },
  handler: function* deleteCategories({
    ids,
  }): Generator<unknown, void, unknown> {
    const idsToDelete: string[] = [];

    for (const categoryId of ids) {
      const childrenIds = yield* projectCategoryCardIds({
        projectCategoryId: categoryId,
      });
      const doneChildrenIds = yield* doneProjectCategoryCardIds({
        projectCategoryId: categoryId,
      });

      idsToDelete.push(...childrenIds, ...doneChildrenIds);
    }

    if (idsToDelete.length > 0) {
      yield* deleteCardsByIds({ ids: idsToDelete });
    }

    yield* deleteRows(projectCategoriesTable, ids);
  },
});

export const projectCategoryHandleDrop = action({
  name: "projectCategoryHandleDrop",
  args: {
    categoryId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* projectCategoryHandleDrop({
    categoryId,
    dropId,
    dropModelType,
    edge,
  }): Generator<unknown, void, unknown> {
    const dropItem = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!dropItem) return;

    const childrenIds = yield* projectCategoryCardIds({
      projectCategoryId: categoryId,
    });
    let orderToken: string;
    if (childrenIds.length === 0) {
      orderToken = generateJitteredKeyBetween(null, null);
    } else if (edge === "top") {
      const first = yield* projectCategoryCardByIdOrDefault({
        id: childrenIds[0],
      });
      orderToken = generateJitteredKeyBetween(null, first.orderToken || null);
    } else {
      const last = yield* projectCategoryCardByIdOrDefault({
        id: childrenIds[childrenIds.length - 1],
      });
      orderToken = generateJitteredKeyBetween(last.orderToken || null, null);
    }

    if (isTask(dropItem)) {
      yield* updateTask({
        id: dropItem.id,
        task: {
          projectCategoryId: categoryId,
          orderToken,
        },
      });
    } else if (isTaskTemplate(dropItem)) {
      yield* updateTemplate({
        id: dropItem.id,
        template: {
          projectCategoryId: categoryId,
          orderToken,
        },
      });
    } else if (isTaskProjection(dropItem)) {
      // When dropping a projection onto a category, move the underlying task
      const task = yield* taskById({ id: dropItem.id });
      if (task) {
        yield* updateTask({
          id: task.id,
          task: {
            projectCategoryId: categoryId,
            orderToken,
          },
        });
        // Keep the projection in the daily list
      }
    }
  },
});

export const projectCategoryCanDrop = selector({
  name: "projectCategoryCanDrop",
  args: {
    _categoryId: v.string(),
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* projectCategoryCanDrop({
    _categoryId,
    dropId,
    dropModelType,
  }): Generator<unknown, boolean, unknown> {
    yield* noop();

    const dropItem = yield* appById({
      id: dropId,
      modelType: dropModelType,
    });
    if (!dropItem) return false;

    if (isTask(dropItem) || isTaskTemplate(dropItem)) {
      return true;
    }

    if (isTaskProjection(dropItem)) {
      const task = yield* taskById({ id: dropItem.id });
      return task !== undefined && task.state === "todo";
    }

    return false;
  },
});

const projectCategoriesSlice = {
  byId: projectCategoryById,
  delete: deleteCategories,
  handleDrop: projectCategoryHandleDrop,
  canDrop: projectCategoryCanDrop,
};

registerModelSlice(
  projectCategoriesSlice,
  projectCategoriesTable,
  projectCategoryType,
);
