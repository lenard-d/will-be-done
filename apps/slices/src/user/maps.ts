import { Space, spacesTable } from "./tables";

export type AnyTable = typeof spacesTable;
export type AnyModel = Space;
export type AnyModelType = AnyModel["type"];
