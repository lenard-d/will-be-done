import {
  Description,
  Dialog,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useUnmount } from "../../utils";
import { useFocusStore } from "@/store/focusSlice.ts";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import { allProjectsSorted } from "@will-be-done/slices/space";

export type MoveDestination = { id: string; title: string };

export const MoveDestinationModal = ({
  setIsOpen,
  handleMove,
  destinations,
  title = "Choose destination",
  searchPlaceholder = "Search...",
}: {
  setIsOpen: (val: boolean) => void;
  handleMove: (destinationId: string) => void;
  destinations: MoveDestination[];
  title?: string;
  searchPlaceholder?: string;
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filteredDestinations = useMemo(
    () =>
      destinations.filter((destination) =>
        destination.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [destinations, searchQuery],
  );

  const updateSearchQuery = useCallback((data: string) => {
    setSelectedIndex(0);
    setSearchQuery(data);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.code === "KeyJ")) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredDestinations.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.code === "KeyK")) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter" && filteredDestinations[selectedIndex]) {
      e.preventDefault();
      setIsOpen(false);
      handleMove(filteredDestinations[selectedIndex].id);
    }
  };

  useEffect(() => {
    useFocusStore.getState().disableFocus();

    inputRef.current?.focus();
  }, []);

  useUnmount(() => {
    useFocusStore.getState().enableFocus();
  });

  return (
    <Dialog
      static
      className="fixed inset-0 z-[10000]"
      open
      onClose={() => setIsOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        <DialogPanel className="mx-auto flex h-[70vh] w-full max-w-3xl flex-col rounded-lg bg-popover p-5 ring-1 ring-ring backdrop-blur-xl">
          <DialogTitle
            className="mb-3 border-b border-ring pb-3 text-lg font-medium leading-6 text-primary"
            as="h3"
          >
            {title}
          </DialogTitle>
          <div className="mb-4">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => updateSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded bg-surface-elevated px-3 py-2.5 text-content placeholder-content-tinted-2 border border-ring transition-all focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <Description className="flex-1 overflow-y-auto" as="div">
            <div className="grid gap-1 text-content">
              {filteredDestinations.map((destination, index) => (
                <button
                  key={destination.id}
                  type="button"
                  className={`cursor-pointer rounded px-3 py-2.5 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-accent/20 text-primary border border-accent"
                      : "border border-transparent hover:bg-panel-hover"
                  }`}
                  onClick={() => {
                    setIsOpen(false);
                    handleMove(destination.id);
                  }}
                >
                  {destination.title}
                </button>
              ))}
            </div>
          </Description>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export const MoveModal = ({
  setIsOpen,
  handleMove,
  exceptProjectId,
}: {
  setIsOpen: (val: boolean) => void;
  handleMove: (projectId: string) => void;
  exceptProjectId: string;
}) => {
  const { data: allProjects = [] } = useAsyncSelector({
    selector: allProjectsSorted,
    args: {},
  });
  const destinations = useMemo(
    () =>
      allProjects
        .filter((project) => project.id !== exceptProjectId)
        .map((project) => ({ id: project.id, title: project.title })),
    [allProjects, exceptProjectId],
  );

  return (
    <MoveDestinationModal
      setIsOpen={setIsOpen}
      handleMove={handleMove}
      destinations={destinations}
      title="Choose project"
      searchPlaceholder="Search projects..."
    />
  );
};
