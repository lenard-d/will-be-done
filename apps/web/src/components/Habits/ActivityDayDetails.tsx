import { useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DayMetric } from "./habitStats";

export const ActivityDayDetails = ({
  day,
  className,
  children,
}: {
  day: DayMetric;
  className: string;
  children?: ReactNode;
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const details = `${format(parseISO(day.date), "EEEE, MMMM d, yyyy")}: ${day.count} ${day.count === 1 ? "activity" : "activities"}`;

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={(open) => {
        setPopoverOpen(open);
        setTooltipOpen(false);
      }}
    >
      <Tooltip open={tooltipOpen && !popoverOpen} onOpenChange={setTooltipOpen}>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <button type="button" className={className} aria-label={details}>
              {children}
            </button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent
          sideOffset={6}
          className="bg-panel-tinted-opaque text-content shadow-lg [&_svg]:bg-panel-tinted-opaque [&_svg]:fill-panel-tinted-opaque"
        >
          {details}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-2rem)] bg-panel-tinted-opaque px-3 py-2 text-xs"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {details}
      </PopoverContent>
    </Popover>
  );
};
