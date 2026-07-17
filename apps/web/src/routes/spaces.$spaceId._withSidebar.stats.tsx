import { createFileRoute } from "@tanstack/react-router";
import { StatsView } from "@/components/Habits/StatsView";

export const Route = createFileRoute("/spaces/$spaceId/_withSidebar/stats")({
  component: StatsView,
});
