import { Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Route } from "@/routes/spaces.$spaceId.tsx";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { NavBar } from "../NavBar/NavBar";
import { useCurrentDate } from "./hooks";
import { TaskSortControl } from "@/components/TaskSorting/TaskSortControl";

export const NavPanel = ({
  previousDate,
  nextDate,
  selectedDate,
  selectedProjectId,
}: {
  previousDate: Date;
  nextDate: Date;
  selectedDate: Date;
  selectedProjectId: string;
}) => {
  const spaceId = Route.useParams().spaceId;
  const navigate = useNavigate();
  const today = useCurrentDate();
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <header
      className="absolute inset-x-0 top-0 z-40 flex flex-wrap items-center justify-between gap-y-1 bg-surface px-1 py-1 [app-region:no-drag]"
      data-task-sort-view="timeline"
    >
      <div className="flex items-center gap-2">
        <NavBar spaceId={spaceId} />
        <Link
          to="/spaces/$spaceId/dates/$date"
          params={{ spaceId, date: format(today, "yyyy-MM-dd") }}
          className="rounded px-2 py-1 text-xs text-content-tinted hover:bg-surface-elevated hover:text-content"
        >
          Today
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2 w-full min-[650px]:w-auto">
        <TaskSortControl viewKey="timeline" />
        <div className="bg-surface-elevated rounded-lg text-[12px] text-content flex items-center justify-center h-8 stroke-content ring-1 ring-ring px-2">
          <div className="flex items-center gap-2 h-full shrink-0">
            <Link
              to="/spaces/$spaceId/timeline/$date"
              params={{
                date: format(previousDate, "yyyy-MM-dd"),
                spaceId,
              }}
              className="cursor-pointer w-5 flex items-center justify-center h-full text-content-tinted hover:text-primary transition-colors"
              aria-label="Previous day"
              search={{
                projectId: selectedProjectId,
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                width="4"
                height="6"
                viewBox="0 0 4 6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5.5.5 3 3 .5"
                />
              </svg>
            </Link>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <span className="font-medium cursor-pointer hover:text-primary transition-colors select-none w-20 text-center">
                  {format(selectedDate, "dd MMM yyyy")}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      void navigate({
                        to: "/spaces/$spaceId/timeline/$date",
                        params: { spaceId, date: format(date, "yyyy-MM-dd") },
                        search: { projectId: selectedProjectId },
                      });
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            <Link
              to="/spaces/$spaceId/timeline/$date"
              params={{
                date: format(nextDate, "yyyy-MM-dd"),
                spaceId,
              }}
              search={{
                projectId: selectedProjectId,
              }}
              className="cursor-pointer w-5 flex items-center justify-center h-full text-content-tinted hover:text-primary transition-colors"
              aria-label="Next day"
            >
              <svg
                width="4"
                height="6"
                viewBox="0 0 4 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.5 0.499999L3 3L0.5 5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
