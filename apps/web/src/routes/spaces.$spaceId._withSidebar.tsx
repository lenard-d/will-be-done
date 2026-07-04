import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CardDetails } from "@/components/CardDetails/CardDetails.tsx";
import { GlobalLayout } from "@/components/Layout/GlobalLayout.tsx";
import { LayoutWithSidebar } from "@/components/Layout/LayoutWithSidebar";
import { preloadSelectorAsync } from "@will-be-done/hyperdb";
import { projectsWithTaskStats } from "@will-be-done/slices/space";
import { startOfDay } from "date-fns";

export const Route = createFileRoute("/spaces/$spaceId/_withSidebar")({
  component: RouteComponent,
  loader: async ({ context }) => {
    const db = await context.spaceDbPromise;
    await preloadSelectorAsync(db, {
      selector: projectsWithTaskStats,
      args: { currentDate: startOfDay(new Date()).getTime() },
    });
  },
});

function RouteComponent() {
  return (
    <GlobalLayout>
      <LayoutWithSidebar>
        <div className="flex h-full min-h-0">
          <div className="min-w-[300px] flex-1">
            <Outlet />
          </div>
          <div className="hidden h-full sm:block">
            <CardDetails />
          </div>
        </div>
      </LayoutWithSidebar>
    </GlobalLayout>
  );
}
