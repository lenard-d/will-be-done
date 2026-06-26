import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { parse } from "date-fns";
import { GlobalLayout } from "@/components/Layout/GlobalLayout.tsx";
import { Board } from "@/components/DaysBoard/DaysBoard.tsx";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { inboxProjectId as getInboxProjectId } from "@will-be-done/slices/space";

const filterParams = z.object({
  projectId: z.string().default("inbox"),
});

export const Route = createFileRoute("/spaces/$spaceId/timeline/$date")({
  component: RouteComponent,
  validateSearch: zodValidator(filterParams),
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
