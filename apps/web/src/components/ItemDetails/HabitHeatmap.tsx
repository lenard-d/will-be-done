import { useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import {
  toggleHabitCompletionAt,
  type HabitCompletion,
} from "@will-be-done/slices/space";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { cn } from "@/lib/utils";
import { buildHabitHeatmap } from "./habitHeatmapData";

export function HabitHeatmap({
  habitId,
  habitCreatedAt,
  completions,
}: {
  habitId: string;
  habitCreatedAt: number;
  completions: HabitCompletion[];
}) {
  const dispatch = useAsyncDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const weeks = useMemo(
    () => buildHabitHeatmap(completions, habitCreatedAt),
    [completions, habitCreatedAt],
  );

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [habitId]);

  return (
    <section className="border-t border-task-panel-divider pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-content-tinted/70">
          Activity
        </h3>
        <span className="text-[10px] text-content-tinted/55">Last 16 weeks</span>
      </div>

      <div className="flex min-w-0 gap-1.5">
        <div className="grid shrink-0 grid-rows-[repeat(7,1.5rem)] pt-4 text-[9px] leading-6 text-content-tinted/55" aria-hidden="true">
          <span>M</span>
          <span />
          <span>W</span>
          <span />
          <span>F</span>
          <span />
          <span />
        </div>
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-x-auto pb-1"
          aria-label="Habit completion heatmap"
        >
          <div className="inline-flex min-w-max pt-4">
            {weeks.map((week) => (
              <div
                key={week.key}
                className="relative grid grid-rows-[repeat(7,1.5rem)]"
              >
                {week.monthLabel && (
                  <span className="absolute -top-4 left-0 text-[9px] uppercase text-content-tinted/55">
                    {week.monthLabel}
                  </span>
                )}
                {week.days.map((day) => {
                  const label = format(
                    new Date(`${day.date}T12:00:00`),
                    "MMMM d, yyyy",
                  );
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="checkbox"
                      aria-checked={day.checked}
                      aria-label={`${label}: ${day.checked ? "completed" : "not completed"}`}
                      title={`${label}: ${day.checked ? "completed" : "not completed"}`}
                      disabled={day.disabled}
                      onClick={() =>
                        void dispatch(
                          toggleHabitCompletionAt({
                            habitId,
                            completedAt: day.completedAt,
                          }),
                        )
                      }
                      className={cn(
                        "group flex h-6 w-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                        day.disabled && "cursor-default",
                      )}
                    >
                      <span
                        className={cn(
                          "h-3 w-3 rounded-[3px] transition-colors",
                          day.checked
                            ? "bg-accent"
                            : "bg-panel-tinted group-hover:bg-accent/30",
                          day.isToday && "ring-1 ring-accent",
                          day.disabled &&
                            "opacity-20 group-hover:bg-panel-tinted",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-content-tinted/55">
        Select a day to update this habit.
      </p>
    </section>
  );
}
