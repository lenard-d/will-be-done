import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  activeHabits,
  allHabitCompletions,
  allTasks,
} from "@will-be-done/slices/space";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { useCurrentDate } from "@/components/DaysBoard/hooks";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils.ts";
import { ActivityDayDetails } from "./ActivityDayDetails";
import {
  buildHabitStats,
  type ActivityHeatmap as ActivityHeatmapData,
  type DayMetric,
} from "./habitStats";

const intensityClass = (count: number, max: number) => {
  if (count === 0 || max === 0) return "bg-panel-tinted";
  const ratio = count / max;
  if (ratio >= 0.85) return "bg-accent";
  if (ratio >= 0.6) return "bg-accent/75";
  if (ratio >= 0.35) return "bg-accent/45";
  return "bg-accent/20";
};

const ActivityHeatmap = ({ heatmap }: { heatmap: ActivityHeatmapData }) => {
  const max = Math.max(0, ...heatmap.days.map((day) => day.count));
  const weekColumns = `repeat(${heatmap.days.length / 7}, minmax(0, 1fr))`;

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-bold text-content">Activity history</h2>
      <p className="mt-1 text-sm text-content-tinted/75">Last 13 weeks</p>
      <div className="mt-6 w-full max-w-sm">
        <div
          className="mb-2 grid gap-1 text-xs text-content-tinted/75"
          style={{ gridTemplateColumns: weekColumns }}
          aria-hidden="true"
        >
          {heatmap.monthLabels.map((label) => (
            <span
              key={`${label.label}-${label.weekIndex}`}
              className="last:justify-self-end"
              style={{ gridColumn: label.weekIndex + 1 }}
            >
              {label.label}
            </span>
          ))}
        </div>
        <div
          className="grid grid-flow-col grid-rows-7 gap-1"
          style={{ gridTemplateColumns: weekColumns }}
        >
          {heatmap.days.map((day) =>
            day.isPadding ? (
              <div key={day.date} aria-hidden="true" />
            ) : (
              <ActivityDayDetails
                key={day.date}
                day={day}
                className={cn(
                  "aspect-square w-full rounded-[3px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  intensityClass(day.count, max),
                  day.isToday && "ring-1 ring-accent",
                )}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
};

const DailyActivityChart = ({ days }: { days: DayMetric[] }) => {
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <section className="min-w-0">
      <h2 className="text-xl font-bold text-content">Daily activity</h2>
      <p className="mt-1 text-sm text-content-tinted/75">Last 30 days</p>
      <div className="mt-6 flex h-44 items-end gap-1 rounded-lg bg-panel-tinted/60 px-3 py-3 ring-1 ring-ring/50 sm:gap-1.5">
        {days.map((day) => (
          <ActivityDayDetails
            key={day.date}
            day={day}
            className="flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <div
              className={cn(
                "w-full rounded-t-sm bg-accent/50",
                day.isToday && "ring-1 ring-accent",
              )}
              style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
            />
          </ActivityDayDetails>
        ))}
      </div>
      <div
        className="mt-2 flex justify-between text-xs text-content-tinted/75"
        aria-hidden="true"
      >
        <span>{days[0] && format(parseISO(days[0].date), "MMM d")}</span>
        <span>Today</span>
      </div>
    </section>
  );
};

export const StatsView = () => {
  const { data: tasks = [] } = useAsyncSelector({
    selector: allTasks,
    args: {},
  });
  const { data: habits = [] } = useAsyncSelector({
    selector: activeHabits,
    args: {},
  });
  const { data: completions = [] } = useAsyncSelector({
    selector: allHabitCompletions,
    args: {},
  });
  const today = format(useCurrentDate(), "yyyy-MM-dd");
  const stats = useMemo(
    () => buildHabitStats(tasks, habits, completions, parseISO(today)),
    [tasks, habits, completions, today],
  );
  const blocks = [
    ["tasks done", stats.totalDone, "all-time"],
    ["habit check-ins", stats.totalHabitCompletions, "all-time"],
    ["recent activity", stats.doneLast30Days, "last 30 days"],
    ["current streak", `${stats.currentStreakDays}d`, "global activity"],
    ["best streak", `${stats.bestStreakDays}d`, "global activity"],
  ] as const;

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-4xl font-bold text-content">Stats</h1>
        </header>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {blocks.map(([label, value, helper]) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-widest text-content-tinted/55">
                {label}
              </div>
              <div className="mt-2 text-3xl font-bold tabular-nums text-content">
                {value}
              </div>
              <div className="mt-1 text-xs text-content-tinted/65">
                {helper}
              </div>
            </div>
          ))}
        </div>
        <TooltipProvider delayDuration={100}>
          <div className="grid gap-10 xl:grid-cols-2">
            <DailyActivityChart days={stats.last30Days} />
            <ActivityHeatmap heatmap={stats.activityHeatmap} />
          </div>
        </TooltipProvider>
      </main>
    </div>
  );
};
