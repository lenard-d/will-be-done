import { Outlet, createFileRoute } from "@tanstack/react-router";
import { ItemDetails } from "@/components/ItemDetails/ItemDetails.tsx";
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
      <LayoutWithSidebar
        sidePanel={
          <div className="hidden h-full shrink-0 sm:block">
            <ItemDetails />
          </div>
        }
      >
        <Outlet />
      </LayoutWithSidebar>
    </GlobalLayout>
  );
}
