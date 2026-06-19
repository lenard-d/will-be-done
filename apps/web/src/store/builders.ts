import { createAction, createSelector } from "@will-be-done/hyperdb-lib";

export const selector = createSelector({
  validateArgs: false,
});
export const action = createAction({
  validateArgs: false,
});
