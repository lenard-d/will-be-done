import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils.ts";

const linkClass = (isActive: boolean) =>
  cn(
    "px-2 py-1 rounded text-[12px] font-medium whitespace-nowrap transition-colors",
    isActive
      ? "text-accent bg-accent/10"
      : "text-content-tinted/55 hover:text-content/80 hover:bg-white/[0.05]",
  );

export const SpaceNavLinks = ({ spaceId }: { spaceId: string }) => {
  const isTasksActive = useRouterState({
    select: (s) =>
      s.matches.some((m) => {
        return (
          m.pathname.includes("/dates") ||
          m.pathname.includes("/projects") ||
          m.pathname.includes("/all-tasks")
        );
      }),
  });

  const isTimelineActive = useRouterState({
    select: (s) => s.matches.some((m) => m.pathname.includes("/timeline")),
  });

  const isHabitsActive = useRouterState({
    select: (s) => s.matches.some((m) => m.pathname.includes("/habits")),
  });

  const isStatsActive = useRouterState({
    select: (s) => s.matches.some((m) => m.pathname.includes("/stats")),
  });

  return (
    <nav
      aria-label="Space navigation"
      className="flex gap-0.5 items-center h-8 px-1.5 ring-1 ring-ring rounded-lg desktop-macos:ml-20 [app-region:no-drag]"
    >
      <Link
        to="/spaces/$spaceId/all-tasks"
        params={{ spaceId }}
        className={linkClass(isTasksActive)}
        aria-current={isTasksActive ? "page" : undefined}
      >
        Tasks
      </Link>
      <Link
        to="/spaces/$spaceId/timeline"
        params={{ spaceId }}
        className={linkClass(isTimelineActive)}
        aria-current={isTimelineActive ? "page" : undefined}
      >
        Timeline
      </Link>
      <Link
        to="/spaces/$spaceId/habits"
        params={{ spaceId }}
        className={linkClass(isHabitsActive)}
        aria-current={isHabitsActive ? "page" : undefined}
      >
        Habits
      </Link>
      <Link
        to="/spaces/$spaceId/stats"
        params={{ spaceId }}
        className={linkClass(isStatsActive)}
        aria-current={isStatsActive ? "page" : undefined}
      >
        Stats
      </Link>
    </nav>
  );
};
