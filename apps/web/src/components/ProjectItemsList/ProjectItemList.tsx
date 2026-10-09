import { SortedTaskList } from "@/components/TaskSorting/SortedTaskList";
import { TaskSortControl } from "@/components/TaskSorting/TaskSortControl";
import { useTaskSorting } from "@/components/TaskSorting/useTaskSorting";
import { sortTaskItems } from "@/components/TaskSorting/taskSorting";
import { PreloadedTaskComp } from "../Task/Task.tsx";
import { buildFocusKey, useFocusStore } from "@/store/focusSlice.ts";
import { useMemo, useState } from "react";
import { addDays, startOfDay } from "date-fns";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import {
  createProjectSection,
  createTaskInSection,
  deleteProjectSections,
  doneProjectSectionItemsForDisplay,
  moveLeft,
  moveRight,
  type Project,
  projectSectionsByProjectId,
  type ProjectSection,
  projectSectionItemsForDisplayChildren,
  projectSectionSiblings,
  updateProjectSection,
} from "@will-be-done/slices/space";
import {
  TasksColumn,
  TasksColumnAction,
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
  revealSectionId,
}: {
  project: Project;
  section: ProjectSection;
  weekDayTimes?: Set<number>;
  revealSectionId?: string;
}) => {
  const dispatch = useAsyncDispatch();

  const isOnDisplayedWeek = (lastScheduleTime: Date | undefined) =>
    !!lastScheduleTime &&
    !!weekDayTimes?.has(startOfDay(lastScheduleTime).getTime());

  const { sortMode } = useTaskSorting(`project:${project.id}`);

  const { data: itemsForDisplay = [] } = useAsyncSelector({
    selector: projectSectionItemsForDisplayChildren,
    args: { projectSectionId: section.id },
  });
  const [isHiddenClicked, setIsHiddenClicked] = useState(false);
  const handleHideClick = () => setIsHiddenClicked((v) => !v);

  const [isShowMore, setIsShowMore] = useState(false);
  if (revealSectionId === section.id && (isHiddenClicked || !isShowMore)) {
    setIsHiddenClicked(false);
    setIsShowMore(true);
  }
  const { data: doneItemsForDisplay = [] } = useAsyncSelector({
    selector: doneProjectSectionItemsForDisplay,
    args: {
      projectSectionId: section.id,
      limited: !isShowMore && sortMode === "manual",
    },
  });

  const isHidden =
    isHiddenClicked ||
    (doneItemsForDisplay.length == 0 && itemsForDisplay.length == 0);
  const handleAddClick = () => {
    if (isHidden) {
      setIsHiddenClicked(false);
    }

    void (async () => {
      const task = await dispatch(
        createTaskInSection({
          projectSectionId: section.id,
          position: "prepend",
        }),
      );

      useFocusStore.getState().editByKey(buildFocusKey(task.id, task.type));
    })();
  };

  const finalDoneIds = useMemo(() => {
    const sortedDone = sortTaskItems({
      items: doneItemsForDisplay,
      mode: sortMode,
    });
    if (isShowMore) {
      return sortedDone;
    }
    return sortedDone.slice(0, 5);
  }, [doneItemsForDisplay, isShowMore, sortMode]);

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
          <TasksColumnAction
            label="Add column to the left"
            onClick={() => {
              void (async () => {
                const title = await promptDialog("Enter new name");
                if (!title) return;

                const [left, _right] = await dispatch(
                  projectSectionSiblings({ projectSectionId: section.id }),
                );

                await dispatch(
                  createProjectSection({
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
          </TasksColumnAction>
          <TasksColumnAction
            label="Add column to the right"
            onClick={() => {
              void (async () => {
                const title = await promptDialog("Enter new name");
                if (!title) return;

                const [_left, right] = await dispatch(
                  projectSectionSiblings({ projectSectionId: section.id }),
                );

                await dispatch(
                  createProjectSection({
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
          </TasksColumnAction>
          <TasksColumnAction
            label="Move column to the left"
            onClick={() => {
              void dispatch(moveLeft({ projectSectionId: section.id }));
            }}
          >
            <MoveLeftIcon className="rotate-180" />
          </TasksColumnAction>
          <TasksColumnAction
            label="Move column to the right"
            onClick={() => {
              void dispatch(moveRight({ projectSectionId: section.id }));
            }}
          >
            <MoveRightIcon className="rotate-180" />
          </TasksColumnAction>
          <TasksColumnAction
            label="Delete column"
            onClick={() => {
              const confirmed = confirm(
                "Are you sure you want to delete this project section?",
              );
              if (!confirmed) return;

              void dispatch(deleteProjectSections({ ids: [section.id] }));
            }}
          >
            <TrashIcon className="rotate-180" />
          </TasksColumnAction>
          <TasksColumnAction
            className="mb-6"
            label="Edit column name"
            onClick={() => {
              void (async () => {
                const newTitle = await promptDialog(
                  "Enter new title",
                  section.title,
                );
                if (!newTitle) return;

                await dispatch(
                  updateProjectSection({
                    projectSectionId: section.id,
                    section: {
                      title: newTitle,
                    },
                  }),
                );
              })();
            }}
          >
            <PencilIcon className="rotate-180" />
          </TasksColumnAction>
        </>
      }
    >
      <div className="flex flex-col gap-4 w-full py-4">
        <SortedTaskList items={itemsForDisplay} mode={sortMode}>
          {(displayData) => {
            return (
              <PreloadedTaskComp
                key={displayData.listItem.id}
                item={displayData.item}
                section={displayData.section}
                listItem={displayData.listItem}
                project={displayData.project}
                lastScheduleTime={displayData.lastScheduleTime}
                displayedUnderProjectId={project.id}
                hasCheclistItems={displayData.hasChecklist}
                displayLastScheduleTime
                isOnTimeline={isOnDisplayedWeek(displayData.lastScheduleTime)}
              />
            );
          }}
        </SortedTaskList>
        <SortedTaskList items={finalDoneIds} mode={sortMode}>
          {(displayData) => {
            return (
              <PreloadedTaskComp
                key={displayData.listItem.id}
                item={displayData.item}
                section={displayData.section}
                listItem={displayData.listItem}
                project={displayData.project}
                lastScheduleTime={displayData.lastScheduleTime}
                displayedUnderProjectId={project.id}
                hasCheclistItems={displayData.hasChecklist}
                displayLastScheduleTime
                isOnTimeline={isOnDisplayedWeek(displayData.lastScheduleTime)}
              />
            );
          }}
        </SortedTaskList>

        {!isShowMore && doneItemsForDisplay.length > 5 && (
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
  revealSectionId,
  header = <TaskSortControl viewKey={`project:${project.id}`} />,
}: {
  project: Project;
  selectedDate?: Date;
  revealSectionId?: string;
  header?: React.ReactNode;
}) => {
  const { data: sections = [] } = useAsyncSelector({
    selector: projectSectionsByProjectId,
    args: { projectId: project.id },
  });

  const { sortMode } = useTaskSorting(`project:${project.id}`);

  const weekDayTimes = useMemo(() => {
    if (!selectedDate) return undefined;
    const start = startOfDay(selectedDate);
    return new Set(
      Array.from({ length: 7 }, (_, i) => addDays(start, i).getTime()),
    );
  }, [selectedDate]);

  return (
    <div
      data-task-sort-view={`project:${project.id}`}
      data-task-sort-mode={sortMode}
    >
      {header && <div className="flex justify-end px-4 pt-2">{header}</div>}
      <TasksColumnGrid columnsCount={sections.length}>
        {sections.map((group) => (
          <ProjectTasksColumn
            key={group.id}
            section={group}
            revealSectionId={revealSectionId}
            project={project}
            weekDayTimes={weekDayTimes}
          />
        ))}
      </TasksColumnGrid>
    </div>
  );
};
