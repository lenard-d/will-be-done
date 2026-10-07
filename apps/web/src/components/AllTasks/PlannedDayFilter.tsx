import { useState } from "react";
import { format, parse, startOfWeek, endOfWeek, subDays } from "date-fns";
import { ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { filterButtonClass } from "./filterStyles";
import type { PlannedDayFilter as DayFilter } from "./taskFilters";

const dateLabel = (date: string) =>
  format(parse(date, "yyyy-MM-dd", new Date()), "d MMM yyyy");

function dayFilterLabel(filter: DayFilter) {
  switch (filter.kind) {
    case "all":
      return "All";
    case "scheduled":
      return "Scheduled";
    case "unscheduled":
      return "No date";
    case "on":
      return dateLabel(filter.date);
    case "range":
      return `${filter.from ? dateLabel(filter.from) : "Any"} to ${filter.to ? dateLabel(filter.to) : "Any"}`;
  }
}

export function PlannedDayFilter({
  value,
  onChange,
}: {
  value: DayFilter;
  onChange: (filter: DayFilter) => void;
}) {
  const [endpoint, setEndpoint] = useState<"from" | "to">("from");
  const selectedDate =
    value.kind === "on"
      ? value.date
      : value.kind === "range"
        ? value[endpoint]
        : null;
  const today = format(new Date(), "yyyy-MM-dd");
  const modes: { label: string; filter: DayFilter }[] = [
    { label: "All dates", filter: { kind: "all" } },
    { label: "Scheduled", filter: { kind: "scheduled" } },
    { label: "No date", filter: { kind: "unscheduled" } },
    {
      label: "Specific day",
      filter: { kind: "on", date: value.kind === "on" ? value.date : today },
    },
    {
      label: "Date range",
      filter:
        value.kind === "range"
          ? value
          : { kind: "range", from: null, to: null },
    },
  ];
  const selectDate = (date: Date | undefined) => {
    if (!date) return;
    const day = format(date, "yyyy-MM-dd");
    if (value.kind === "on") onChange({ kind: "on", date: day });
    if (value.kind === "range") {
      if (endpoint === "from")
        onChange({
          kind: "range",
          from: day,
          to: value.to && value.to < day ? day : value.to,
        });
      else
        onChange({
          kind: "range",
          from: value.from && value.from > day ? day : value.from,
          to: day,
        });
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by planned day"
          className={filterButtonClass}
        >
          <span className="truncate">Planned day: {dayFilterLabel(value)}</span>
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        onKeyDown={(event) => event.stopPropagation()}
        align="start"
        aria-label="Planned day filter"
        className="z-1100 max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto p-3"
      >
        <div
          role="group"
          aria-label="Planned day matching"
          className="flex flex-wrap gap-2"
        >
          {modes.map(({ label, filter }) => (
            <button
              key={filter.kind}
              type="button"
              aria-pressed={value.kind === filter.kind}
              className={`${filterButtonClass} aria-pressed:border-accent aria-pressed:text-accent`}
              onClick={() => onChange(filter)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-ring pt-3">
          <button
            type="button"
            className={filterButtonClass}
            onClick={() => onChange({ kind: "on", date: today })}
          >
            Today
          </button>
          <button
            type="button"
            className={filterButtonClass}
            onClick={() =>
              onChange({
                kind: "range",
                from: format(
                  startOfWeek(new Date(), { weekStartsOn: 1 }),
                  "yyyy-MM-dd",
                ),
                to: format(
                  endOfWeek(new Date(), { weekStartsOn: 1 }),
                  "yyyy-MM-dd",
                ),
              })
            }
          >
            This week
          </button>
          <button
            type="button"
            className={filterButtonClass}
            onClick={() =>
              onChange({
                kind: "range",
                from: null,
                to: format(subDays(new Date(), 1), "yyyy-MM-dd"),
              })
            }
          >
            Before today
          </button>
        </div>
        {value.kind === "range" && (
          <div
            role="group"
            aria-label="Date range bounds"
            className="mt-3 flex flex-col gap-2"
          >
            {(["from", "to"] as const).map((bound) => (
              <button
                key={bound}
                type="button"
                aria-pressed={endpoint === bound}
                className={`${filterButtonClass} justify-between aria-pressed:border-accent`}
                onClick={() => setEndpoint(bound)}
              >
                {bound === "from" ? "From" : "Through"}:{" "}
                {value[bound] ? dateLabel(value[bound]) : "Any date"}
              </button>
            ))}
          </div>
        )}
        {(value.kind === "on" || value.kind === "range") && (
          <Calendar
            key={`${value.kind}:${endpoint}`}
            mode="single"
            selected={
              selectedDate
                ? parse(selectedDate, "yyyy-MM-dd", new Date())
                : undefined
            }
            defaultMonth={
              selectedDate
                ? parse(selectedDate, "yyyy-MM-dd", new Date())
                : undefined
            }
            onSelect={selectDate}
            className="mx-auto mt-2 p-1"
          />
        )}
        {value.kind === "range" && selectedDate && (
          <button
            type="button"
            className={filterButtonClass}
            onClick={() => onChange({ ...value, [endpoint]: null })}
          >
            Clear {endpoint === "from" ? "start" : "end"} date
          </button>
        )}
        <div className="mt-3 border-t border-ring pt-3">
          <button
            type="button"
            className={filterButtonClass}
            onClick={() => onChange({ kind: "all" })}
          >
            Clear planned day filter
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
