import { useMemo } from "react";
import { format } from "date-fns";
import {
  activeHabits,
  allHabitCompletions,
  allTasks,
} from "@will-be-done/slices/space";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { cn } from "@/lib/utils.ts";
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
  return (
    <section>
      <div className="text-[10px] uppercase tracking-[0.18em] text-content-tinted/55">
        global activity
      </div>
      <h2 className="mt-1 text-2xl font-bold uppercase text-content">
        {heatmap.year} year to date
      </h2>
      <div className="mt-6 overflow-x-auto pt-5">
        <div className="relative inline-block min-w-full">
          {heatmap.monthLabels.map((label) => (
            <div
              key={`${label.label}-${label.weekIndex}`}
              className="absolute -top-5 text-[11px] uppercase text-content-tinted/65"
              style={{ left: `${label.weekIndex * 20}px` }}
            >
              {label.label}
            </div>
          ))}
          <div
            className="grid grid-flow-col grid-rows-7 gap-1.5"
            style={{ gridAutoColumns: "14px" }}
          >
            {heatmap.days.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} activities`}
                className={cn(
                  "h-3.5 w-3.5 rounded-[3px]",
                  day.isPadding
                    ? "opacity-0"
                    : intensityClass(day.count, max),
                  day.isToday && "ring-1 ring-accent",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const DoneChart = ({ days }: { days: DayMetric[] }) => {
  const max = Math.max(1, ...days.map((day) => day.count));
  return (
    <section>
      <div className="text-[10px] uppercase tracking-[0.18em] text-content-tinted/55">
        last 30 days
      </div>
      <h2 className="mt-1 text-2xl font-bold uppercase text-content">
        activity baseline
      </h2>
      <div className="mt-6 flex h-44 items-end gap-1.5 rounded-lg bg-panel-tinted/60 px-3 py-3 ring-1 ring-ring/50">
        {days.map((day) => (
          <div
            key={day.date}
            title={`${format(new Date(`${day.date}T00:00:00`), "MMM d")}: ${day.count}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={cn(
                "w-full rounded-t-sm bg-accent/50",
                day.isToday && "ring-1 ring-accent",
              )}
              style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export const StatsView = () => {
  const { data: tasks = [] } = useAsyncSelector({ selector: allTasks, args: {} });
  const { data: habits = [] } = useAsyncSelector({
    selector: activeHabits,
    args: {},
  });
  const { data: completions = [] } = useAsyncSelector({
    selector: allHabitCompletions,
    args: {},
  });
  const stats = useMemo(
    () => buildHabitStats(tasks, habits, completions),
    [tasks, habits, completions],
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
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
        <header>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/75">
            space stats
          </div>
          <h1 className="mt-2 text-4xl font-bold uppercase text-content">
            stats
          </h1>
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
        <div className="grid gap-10 xl:grid-cols-2">
          <DoneChart days={stats.last30Days} />
          <ActivityHeatmap heatmap={stats.activityHeatmap} />
        </div>
      </main>
    </div>
  );
};
