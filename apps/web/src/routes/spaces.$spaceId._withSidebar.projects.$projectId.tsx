import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProjectDetailView } from "@/components/ProjectView/ProjectDetailView.tsx";
import { getDBBySpaceId, initDbStore } from "@/store/load";
import { asyncDispatch } from "@will-be-done/hyperdb";
import { projectByIdOrDefault } from "@will-be-done/slices/space";
import { authUtils, isDemoMode } from "@/lib/auth";
import { demoSpaceDBConfig, spaceDBConfig } from "@/store/configs";

export const Route = createFileRoute(
  "/spaces/$spaceId/_withSidebar/projects/$projectId",
)({
  component: RouteComponent,
  loader: async ({ params }) => {
    if (!isDemoMode() && !authUtils.isAuthenticated()) {
      throw redirect({ to: "/login" });
    }

    if (!isDemoMode()) {
      authUtils.setLastUsedSpaceId(params.spaceId);
    }

    const config = isDemoMode()
      ? demoSpaceDBConfig()
      : spaceDBConfig(params.spaceId);

    const db = await initDbStore(config);

    await asyncDispatch(db, projectByIdOrDefault({ id: params.projectId }));
  },
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return <ProjectDetailView projectId={projectId} />;
}
