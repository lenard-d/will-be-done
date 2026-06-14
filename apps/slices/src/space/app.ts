import { action, selector, v } from "@will-be-done/hyperdb-lib";
import { defaultTask } from "./cardsTasks";
import { AnyModel, appTypeSlicesMap } from "./maps";

export const possibleModelType = v.union(
  v.literal("task"),
  v.literal("template"),
  v.literal("project"),
  v.literal("dailyList"),
  v.literal("projectCategory"),
  v.literal("projection"),
  v.literal("stashProjection"),
  v.literal("checklistItem"),
  v.literal("stash"),
);

export const appById = selector({
  name: "appById",
  args: {
    id: v.string(),
    modelType: possibleModelType,
  },
  handler: function* appById({ id, modelType }) {
    const slice = appTypeSlicesMap[modelType];
    if (!slice) throw new Error(`Unknown model type: ${modelType}`);
    return (yield* slice.byId(id)) as AnyModel | undefined;
  },
});

export const appByIdOrDefault = selector({
  name: "appByIdOrDefault",
  args: {
    id: v.string(),
    modelType: possibleModelType,
  },
  handler: function* appByIdOrDefault({ id, modelType }) {
    const entity = yield* appById({
      id,
      modelType,
    });
    if (!entity) {
      return defaultTask as AnyModel;
    }

    return entity;
  },
});

export const appCanDrop = selector({
  name: "appCanDrop",
  args: {
    id: v.string(),
    modelType: possibleModelType,
    dropId: v.string(),
    dropModelType: possibleModelType,
  },
  handler: function* appCanDrop({ id, modelType, dropId, dropModelType }) {
    const slice = appTypeSlicesMap[modelType];
    if (!slice) throw new Error(`Unknown model type: ${modelType}`);

    const model = yield* appById({
      id,
      modelType,
    });
    if (!model) {
      // For virtual models (e.g. stash) that have no DB row, use modelType directly
      return yield* slice.canDrop(id, dropId, dropModelType);
    }

    const modelSlice = appTypeSlicesMap[model.type];
    if (!modelSlice) throw new Error(`Unknown model type: ${model.type}`);

    return yield* modelSlice.canDrop(id, dropId, dropModelType);
  },
});

export const appHandleDrop = action({
  name: "appHandleDrop",
  args: {
    id: v.string(),
    modelType: possibleModelType,
    dropId: v.string(),
    dropModelType: possibleModelType,
    edge: v.union(v.literal("top"), v.literal("bottom")),
  },
  handler: function* appHandleDrop({
    id,
    modelType,
    dropId,
    dropModelType,
    edge,
  }): Generator<unknown, void, unknown> {
    const slice = appTypeSlicesMap[modelType];
    if (!slice) throw new Error(`Unknown model type: ${modelType}`);

    const model = yield* appById({
      id,
      modelType,
    });
    if (!model) {
      // For virtual models (e.g. stash) that have no DB row, use modelType directly
      yield* slice.handleDrop(id, dropId, dropModelType, edge);
      return;
    }

    const modelSlice = appTypeSlicesMap[model.type];
    if (!modelSlice) throw new Error(`Unknown model type: ${model.type}`);

    yield* modelSlice.handleDrop(id, dropId, dropModelType, edge);
  },
});

export const appDeleteModel = action({
  name: "appDeleteModel",
  args: {
    id: v.string(),
    modelType: possibleModelType,
  },
  handler: function* appDeleteModel({
    id,
    modelType,
  }): Generator<unknown, void, unknown> {
    const model = yield* appById({
      id,
      modelType,
    });
    if (!model) return;

    const slice = appTypeSlicesMap[model.type];
    if (!slice) throw new Error(`Unknown model type: ${model.type}`);

    yield* slice.delete([id]);
  },
});
