import { Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { filterButtonClass } from "./filterStyles";

export type FilterOption<T extends string = string> = {
  value: T;
  label: string;
};

export function FilterChoices<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
}) {
  const summary =
    selected.length === 1
      ? (options.find((option) => option.value === selected[0])?.label ??
        "1 selected")
      : selected.length
        ? `${selected.length} selected`
        : "All";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter by ${label.toLowerCase()}`}
          className={filterButtonClass}
        >
          <span className="truncate">
            {label}: {summary}
          </span>
          <ChevronDown className="size-3 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        onKeyDown={(event) => event.stopPropagation()}
        align="start"
        aria-label={`${label} filter`}
        className="z-1100 w-72 max-w-[calc(100vw-1rem)] p-0"
      >
        <Command>
          <CommandInput
            placeholder={`Search ${label.toLowerCase()}...`}
            aria-label={`Search ${label.toLowerCase()} filters`}
          />
          <CommandList className="max-h-64">
            <CommandEmpty>No matching options.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                keywords={[option.label]}
                onSelect={() =>
                  onChange(
                    selected.includes(option.value)
                      ? selected.filter((value) => value !== option.value)
                      : [...selected, option.value],
                  )
                }
              >
                <Check
                  aria-hidden
                  className={
                    selected.includes(option.value)
                      ? "size-4 shrink-0"
                      : "size-4 shrink-0 opacity-0"
                  }
                />
                <span className="min-w-0 break-words">{option.label}</span>
                <span className="sr-only">
                  {selected.includes(option.value)
                    ? "Selected"
                    : "Not selected"}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <div className="border-t border-ring p-2">
          <button
            type="button"
            className={filterButtonClass}
            onClick={() => onChange([])}
          >
            Clear {label.toLowerCase()} filter
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
