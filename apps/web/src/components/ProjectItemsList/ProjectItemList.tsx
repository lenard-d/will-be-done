import { PreloadedTaskComp } from "../Task/Task.tsx";
import { buildFocusKey, useFocusStore } from "@/store/focusSlice.ts";
import { useMemo, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import {
  createTaskSection,
  createTaskInSection,
  deleteTaskSections,
  doneTaskSectionCardsForDisplay,
  moveLeft,
  moveRight,
  type Project,
  taskSectionsByProjectId,
  type TaskSection,
  taskSectionCardsForDisplayChildren,
  taskSectionSiblings,
  updateTaskSection,
} from "@will-be-done/slices/space";
import {
  TasksColumn,
  TasksColumnGrid,
} from "@/components/TasksGrid/TasksGrid.tsx";

import {
  AddLeftIcon,
  AddRightIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons.tsx";
import { promptDialog } from "@/components/ui/prompt-dialog-service";

const ProjectTasksColumn = ({
  project,
  section,
  weekDayTimes,
}: {
  project: Project;
  section: TaskSection;
  weekDayTimes?: Set<number>;
}) => {
  const dispatch = useAsyncDispatch();

  const isOnDisplayedWeek = (lastScheduleTime: Date | undefined) =>
    !!lastScheduleTime &&
    !!weekDayTimes?.has(startOfDay(lastScheduleTime).getTime());

  const { data: cardsForDisplay = [] } = useAsyncSelector({
    selector: taskSectionCardsForDisplayChildren,
    args: { taskSectionId: section.id },
  });
  const [isHiddenClicked, setIsHiddenClicked] = useState(false);
  const handleHideClick = () => setIsHiddenClicked((v) => !v);

  const [isShowMore, setIsShowMore] = useState(false);
  const { data: doneCardsForDisplay = [] } = useAsyncSelector({
    selector: doneTaskSectionCardsForDisplay,
    args: { taskSectionId: section.id, limited: !isShowMore },
  });

  const isHidden =
    isHiddenClicked ||
    (doneCardsForDisplay.length == 0 && cardsForDisplay.length == 0);
  const handleAddClick = () => {
    if (isHidden) {
      setIsHiddenClicked(false);
    }

    void (async () => {
      const task = await dispatch(
        createTaskInSection({
          taskSectionId: section.id,
          position: "prepend",
        }),
      );

      useFocusStore.getState().editByKey(buildFocusKey(task.id, task.type));
    })();
  };

  const finalDoneIds = useMemo(() => {
    if (isShowMore) {
      return doneCardsForDisplay;
    }
    return doneCardsForDisplay.slice(0, 5);
  }, [doneCardsForDisplay, isShowMore]);

  return (
    <TasksColumn
      isHidden={isHidden}
      onHideClick={handleHideClick}
      header={
        <>
          <div className="uppercase text-content text-xl font-bold ">
            {section.title}
          </div>
        </>
      }
      columnModelId={section.id}
      columnModelType={section.type}
      onAddClick={handleAddClick}
      actions={
        <>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-2"
            type="button"
            title="Add column to the left"
            onClick={() => {
              void (async () => {
                const title = await promptDialog("Enter new name");
                if (!title) return;

                const [left, _right] = await dispatch(
                  taskSectionSiblings({ taskSectionId: section.id }),
                );

                await dispatch(
                  createTaskSection({
                    sectionDraft: {
                      projectId: section.projectId,
                      title,
                    },
                    position: [left ?? null, section],
                  }),
                );
              })();
            }}
          >
            <AddLeftIcon />
          </button>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-2"
            type="button"
            title="Add column to the right"
            onClick={() => {
              void (async () => {
                const title = await promptDialog("Enter new name");
                if (!title) return;

                const [_left, right] = await dispatch(
                  taskSectionSiblings({ taskSectionId: section.id }),
                );

                await dispatch(
                  createTaskSection({
                    sectionDraft: {
                      projectId: section.projectId,
                      title,
                    },
                    position: [section, right ?? null],
                  }),
                );
              })();
            }}
          >
            <AddRightIcon />
          </button>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-2"
            type="button"
            title="Move column to the left"
            onClick={() => {
              void dispatch(moveLeft({ taskSectionId: section.id }));
            }}
          >
            <MoveLeftIcon className="rotate-180" />
          </button>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-2"
            type="button"
            title="Move column to the right"
            onClick={() => {
              void dispatch(moveRight({ taskSectionId: section.id }));
            }}
          >
            <MoveRightIcon className="rotate-180" />
          </button>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-2"
            type="button"
            title="Delete column"
            onClick={() => {
              const confirmed = confirm(
                "Are you sure you want to delete this project section?",
              );
              if (!confirmed) return;

              void dispatch(deleteTaskSections({ ids: [section.id] }));
            }}
          >
            <TrashIcon className="rotate-180" />
          </button>
          <button
            className="hidden group-hover:block cursor-pointer text-white mb-6"
            type="button"
            title="Edit column name"
            onClick={() => {
              void (async () => {
                const newTitle = await promptDialog(
                  "Enter new title",
                  section.title,
                );
                if (!newTitle) return;

                await dispatch(
                  updateTaskSection({
                    taskSectionId: section.id,
                    section: {
                      title: newTitle,
                    },
                  }),
                );
              })();
            }}
          >
            <PencilIcon className="rotate-180" />
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 w-full py-4">
        {cardsForDisplay.map((displayData) => {
          return (
            <PreloadedTaskComp
              key={displayData.cardWrapper.id}
              card={displayData.card}
              section={displayData.section}
              cardWrapper={displayData.cardWrapper}
              project={displayData.project}
              lastScheduleTime={displayData.lastScheduleTime}
              displayedUnderProjectId={project.id}
              hasCheclistItems={displayData.hasChecklist}
              displayLastScheduleTime
              isOnTimeline={isOnDisplayedWeek(displayData.lastScheduleTime)}
            />
          );
        })}
        {finalDoneIds.map((displayData) => {
          return (
            <PreloadedTaskComp
              key={displayData.cardWrapper.id}
              card={displayData.card}
              section={displayData.section}
              cardWrapper={displayData.cardWrapper}
              project={displayData.project}
              lastScheduleTime={displayData.lastScheduleTime}
              displayedUnderProjectId={project.id}
              hasCheclistItems={displayData.hasChecklist}
              displayLastScheduleTime
              isOnTimeline={isOnDisplayedWeek(displayData.lastScheduleTime)}
            />
          );
        })}

        {!isShowMore && doneCardsForDisplay.length > 5 && (
          <button
            onClick={() => setIsShowMore(true)}
            className="cursor-pointer text-subheader text-sm"
          >
            Show More
          </button>
        )}
      </div>
    </TasksColumn>
  );
};

export const ProjectItemsList = ({
  project,
  selectedDate,
}: {
  project: Project;
  selectedDate?: Date;
}) => {
  const { data: sections = [] } = useAsyncSelector({
    selector: taskSectionsByProjectId,
    args: { projectId: project.id },
  });

  const weekDayTimes = useMemo(() => {
    if (!selectedDate) return undefined;
    const start = startOfDay(selectedDate);
    return new Set(
      Array.from({ length: 7 }, (_, i) => addDays(start, i).getTime()),
    );
  }, [selectedDate]);

  return (
    <>
      <TasksColumnGrid columnsCount={sections.length}>
        {sections.map((group) => (
          <ProjectTasksColumn
            key={group.id}
            section={group}
            project={project}
            weekDayTimes={weekDayTimes}
          />
        ))}
      </TasksColumnGrid>
    </>
  );
};
