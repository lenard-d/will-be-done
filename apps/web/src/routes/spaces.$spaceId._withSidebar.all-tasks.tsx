import { createFileRoute } from "@tanstack/react-router";
import { preloadSelectorAsync } from "@will-be-done/hyperdb";
import { allTasksForDisplay } from "@will-be-done/slices/space";
import { AllTasksView } from "@/components/AllTasks/AllTasksView";

export const Route = createFileRoute("/spaces/$spaceId/_withSidebar/all-tasks")(
  {
    component: AllTasksView,
    loader: async ({ context }) => {
      const db = await context.spaceDbPromise;
      await preloadSelectorAsync(db, {
        selector: allTasksForDisplay,
        args: {},
      });
    },
  },
);
