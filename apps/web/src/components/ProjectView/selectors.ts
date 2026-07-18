import { v } from "@will-be-done/hyperdb";
import { selector } from "@/store/builders.ts";
import { inboxProject, projectByIdOrDefault } from "@will-be-done/slices/space";

export const selectedProject = selector({
  name: "selectedProject",
  args: { selectedProjectId: v.string() },
  handler: function* selectedProject({ selectedProjectId }) {
    if (selectedProjectId === "inbox") {
      return yield* inboxProject({});
    }

    return yield* projectByIdOrDefault({ id: selectedProjectId });
  },
});
