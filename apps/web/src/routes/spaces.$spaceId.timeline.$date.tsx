import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { addDays, parse, startOfDay } from "date-fns";
import { GlobalLayout } from "@/components/Layout/GlobalLayout.tsx";
import { Board } from "@/components/DaysBoard/DaysBoard.tsx";
import { projectItemsExceptTaskIds } from "@/components/ProjectItemsList/selectors.ts";
import { selectedProject } from "@/components/ProjectView/selectors.ts";
import { asyncDispatch, preloadSelector } from "@will-be-done/hyperdb";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import {
  createManyDailyListsIfNotPresent,
  dailyListsByDates,
  dailyProjectionChildrenForDisplay,
  doneDailyProjectionChildrenForDisplay,
  doneProjectCategoryCardsForDisplay,
  inboxProjectId as getInboxProjectId,
  projectCategoriesByProjectId,
  projectCategoryCardsForDisplayChildren,
  projectsWithTaskStats,
} from "@will-be-done/slices/space";

const filterParams = z.object({
  projectId: z.string().default("inbox"),
});

export const Route = createFileRoute("/spaces/$spaceId/timeline/$date")({
  component: RouteComponent,
  validateSearch: zodValidator(filterParams),
  loaderDeps: ({ search }) => ({ projectId: search.projectId }),
  loader: async ({ context, deps, params }) => {
    const db = await context.spaceDbPromise;
    const selectedDate = startOfDay(
      parse(params.date, "yyyy-MM-dd", new Date()),
    );
    const dates = Array.from({ length: 7 }, (_, i) =>
      addDays(selectedDate, i).getTime(),
    );
    const promises: Promise<unknown>[] = [];
    const appendPromise = (promise: Promise<unknown>) => {
      promises.push(promise);
    };

    await asyncDispatch(db, createManyDailyListsIfNotPresent({ dates }));

    const dailyLists = await preloadSelector(db, dailyListsByDates, {
      dates,
    });

    const inboxProjectId = await preloadSelector(db, getInboxProjectId, {});
    const selectedProjectId =
      deps.projectId === "inbox" ? inboxProjectId : deps.projectId;
    const project = await preloadSelector(db, selectedProject, {
      selectedProjectId,
    });

    appendPromise(
      preloadSelector(db, projectsWithTaskStats, {
        currentDate: startOfDay(new Date()).getTime(),
      }),
    );
    appendPromise(preloadSelector(db, projectItemsExceptTaskIds, {}));

    const projectCategories = await preloadSelector(
      db,
      projectCategoriesByProjectId,
      {
        projectId: project.id,
      },
    );

    for (const category of projectCategories) {
      appendPromise(
        preloadSelector(db, projectCategoryCardsForDisplayChildren, {
          projectCategoryId: category.id,
        }),
      );
      appendPromise(
        preloadSelector(db, doneProjectCategoryCardsForDisplay, {
          projectCategoryId: category.id,
          limited: true,
        }),
      );
    }

    for (const dailyList of dailyLists) {
      appendPromise(
        preloadSelector(db, dailyProjectionChildrenForDisplay, {
          dailyListId: dailyList.id,
        }),
      );
      appendPromise(
        preloadSelector(db, doneDailyProjectionChildrenForDisplay, {
          dailyListId: dailyList.id,
        }),
      );
    }

    await Promise.all(promises);
  },
});

function RouteComponent() {
  const params = Route.useParams();
  const { projectId } = Route.useSearch();
  const date = parse(params.date, "yyyy-MM-dd", new Date());

  const { data: inboxProjectId = "" } = useAsyncSelector({
    selector: getInboxProjectId,
    args: {},
  });

  return (
    <GlobalLayout>
      <Board
        selectedDate={date}
        selectedProjectId={projectId === "inbox" ? inboxProjectId : projectId}
      />
    </GlobalLayout>
  );
}
