import { createAction, createSelector } from "@will-be-done/hyperdb-lib";

export const selector = createSelector({
  validateArgs: process.env.NODE_ENV === "development",
  trace: process.env.NODE_ENV === "development",
});
export const action = createAction({
  validateArgs: process.env.NODE_ENV === "development",
  trace: process.env.NODE_ENV === "development",
});
