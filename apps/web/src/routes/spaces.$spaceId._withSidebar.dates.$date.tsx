import { createFileRoute } from "@tanstack/react-router";
import { parse, startOfDay } from "date-fns";
import { DateView } from "@/components/DateView/DateView.tsx";
import { asyncDispatch, preloadSelector } from "@will-be-done/hyperdb";
import {
  createManyDailyListsIfNotPresent,
  dailyListsByDates,
  dailyProjectionChildrenForDisplay,
  doneDailyProjectionChildrenForDisplay,
  inboxProjectId,
} from "@will-be-done/slices/space";

export const Route = createFileRoute(
  "/spaces/$spaceId/_withSidebar/dates/$date",
)({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const db = await context.spaceDbPromise;
    const selectedDate = startOfDay(
      parse(params.date, "yyyy-MM-dd", new Date()),
    );
    const dates = [selectedDate.getTime()];
    const promises: Promise<unknown>[] = [];
    const appendPromise = (promise: Promise<unknown>) => {
      promises.push(promise);
    };

    await asyncDispatch(db, createManyDailyListsIfNotPresent({ dates }));

    const dailyLists = await preloadSelector(db, dailyListsByDates, {
      dates,
    });

    appendPromise(preloadSelector(db, inboxProjectId, {}));

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
  const date = parse(params.date, "yyyy-MM-dd", new Date());

  return <DateView selectedDate={date} />;
}
