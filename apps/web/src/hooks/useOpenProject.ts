import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Route as SpaceRoute } from "@/routes/spaces.$spaceId.tsx";

const timelineDatePattern = /\/timeline\/([^/]+)/;

export function useOpenProject() {
  const navigate = useNavigate();
  const { spaceId } = SpaceRoute.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return useCallback(
    (projectId: string) => {
      const timelineDate = pathname.match(timelineDatePattern)?.[1];

      if (timelineDate) {
        void navigate({
          to: "/spaces/$spaceId/timeline/$date",
          params: { spaceId, date: timelineDate },
          search: { projectId },
        });
        return;
      }

      void navigate({
        to: "/spaces/$spaceId/projects/$projectId",
        params: { spaceId, projectId },
      });
    },
    [navigate, pathname, spaceId],
  );
}
