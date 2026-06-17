import { createAction, createSelector } from "@will-be-done/hyperdb-lib";

export const selector = createSelector({
  validateArgs: false,
  trace: {
    enabled: true,
    startOn: process.env.NODE_ENV === "development" ? "load" : "devtoolOpen",
  },
});

export const action = createAction({
  validateArgs: false,
  trace: {
    enabled: true,
    startOn: process.env.NODE_ENV === "development" ? "load" : "devtoolOpen",
  },
});
