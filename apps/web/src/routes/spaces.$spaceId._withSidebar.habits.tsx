import { createFileRoute } from "@tanstack/react-router";
import { HabitsView } from "@/components/Habits/HabitsView";

export const Route = createFileRoute("/spaces/$spaceId/_withSidebar/habits")({
  component: HabitsView,
});
