import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailView } from "@/components/ProjectView/ProjectDetailView.tsx";
import { preloadSelectorAsync } from "@will-be-done/hyperdb";
import {
  doneProjectCategoryCardsForDisplay,
  projectByIdOrDefault,
  projectCategoriesByProjectId,
  projectCategoryCardsForDisplayChildren,
} from "@will-be-done/slices/space";

export const Route = createFileRoute(
  "/spaces/$spaceId/_withSidebar/projects/$projectId",
)({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const db = await context.spaceDbPromise;
    const promises: Promise<unknown>[] = [];
    const appendPromise = (promise: Promise<unknown>) => {
      promises.push(promise);
    };

    const categories = await preloadSelectorAsync(db, {
      selector: projectCategoriesByProjectId,
      args: { projectId: params.projectId },
    });

    appendPromise(
      preloadSelectorAsync(db, {
        selector: projectByIdOrDefault,
        args: { id: params.projectId },
      }),
    );

    for (const category of categories) {
      appendPromise(
        preloadSelectorAsync(db, {
          selector: projectCategoryCardsForDisplayChildren,
          args: { projectCategoryId: category.id },
        }),
      );
    }

    for (const category of categories) {
      appendPromise(
        preloadSelectorAsync(db, {
          selector: doneProjectCategoryCardsForDisplay,
          args: { projectCategoryId: category.id, limited: true },
        }),
      );
    }

    await Promise.all(promises);
  },
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return <ProjectDetailView projectId={projectId} />;
}
