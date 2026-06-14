import { type Task } from "./cardsTasks";
import { TaskTemplate } from "./cardsTaskTemplates";
import { DailyList } from "./dailyLists";
import { TaskProjection } from "./dailyListsProjections";
import { Project } from "./projects";
import { ProjectCategory } from "./projectsCategories";
import { StashProjection } from "./stashProjections";
import { ChecklistItem } from "./checklistItems";
import {
  tasksTable,
  taskTemplatesTable,
  dailyListsTable,
  taskProjectionsTable,
  projectsTable,
  projectCategoriesTable,
  stashProjectionsTable,
  checklistItemsTable,
} from "./tables";

export type AnyModel =
  | Task
  | TaskTemplate
  | Project
  | DailyList
  | ProjectCategory
  | TaskProjection
  | StashProjection
  | ChecklistItem;

export type AnyModelType = AnyModel["type"] | "stash";

export type AnyTable =
  | typeof tasksTable
  | typeof taskTemplatesTable
  | typeof projectsTable
  | typeof dailyListsTable
  | typeof projectCategoriesTable
  | typeof taskProjectionsTable
  | typeof stashProjectionsTable
  | typeof checklistItemsTable;

type ModelSlice<T> = {
  byId: (id: string) => Generator<unknown, T | undefined, unknown>;
  delete: (ids: string[]) => Generator<unknown, void, unknown>;
  canDrop: (
    id: string,
    dropId: string,
    dropModelType: AnyModelType,
  ) => Generator<unknown, boolean, unknown>;
  handleDrop: (
    id: string,
    dropId: string,
    dropModelType: AnyModelType,
    edge: "top" | "bottom",
  ) => Generator<unknown, void, unknown>;
};

type RegisteredModelSlice = {
  byId: (...args: never[]) => Generator<unknown, AnyModel | undefined, unknown>;
  delete: (...args: never[]) => Generator<unknown, void, unknown>;
  canDrop: (...args: never[]) => Generator<unknown, boolean, unknown>;
  handleDrop: (...args: never[]) => Generator<unknown, void, unknown>;
};

type ObjectCommand = {
  (args: Record<string, unknown>): Generator<unknown, unknown, unknown>;
  args?: Record<string, unknown>;
};

export const appTypeTablesMap: Record<string, AnyTable> = {};
export const appTypeSlicesMap: Record<string, ModelSlice<AnyModel>> = {};

const positionalObjectArgs = (
  command: ObjectCommand,
  values: unknown[],
): Record<string, unknown> => {
  const keys = Object.keys(command.args || {});
  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
};

const callRegistered = <TReturn>(
  command: ObjectCommand,
  values: unknown[],
): Generator<unknown, TReturn, unknown> =>
  command(positionalObjectArgs(command, values)) as Generator<
    unknown,
    TReturn,
    unknown
  >;

export const registerModelSlice = (
  slice: RegisteredModelSlice,
  table: AnyTable,
  modelType: string,
) => {
  appTypeTablesMap[modelType] = table;
  appTypeSlicesMap[modelType] = {
    byId: (id) => callRegistered(slice.byId as unknown as ObjectCommand, [id]),
    delete: (ids) =>
      callRegistered(slice.delete as unknown as ObjectCommand, [ids]),
    canDrop: (id, dropId, dropModelType) =>
      callRegistered(slice.canDrop as unknown as ObjectCommand, [
        id,
        dropId,
        dropModelType,
      ]),
    handleDrop: (id, dropId, dropModelType, edge) =>
      callRegistered(slice.handleDrop as unknown as ObjectCommand, [
        id,
        dropId,
        dropModelType,
        edge,
      ]),
  };
};
