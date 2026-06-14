import { AnyModel, AnyModelType, AnyTable } from "./tables";

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
