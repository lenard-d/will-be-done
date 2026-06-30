import { selector } from "@/store/builders.ts";
import { stashProjectionAllTaskIds } from "@will-be-done/slices/space";

export const projectItemsExceptTaskIds = selector({
  name: "projectItemsExceptTaskIds",
  args: {},
  handler: function* projectItemsExceptTaskIds() {
    return yield* stashProjectionAllTaskIds({});
  },
});
