import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncDispatch } from "@will-be-done/hyperdb/react";
import { useAsyncSelector } from "@will-be-done/hyperdb/react";
import {
  createCategory,
  createProjectCategoryTask,
  deleteCategories,
  doneProjectCategoryCardsForDisplay,
  moveLeft,
  moveRight,
  projectByIdOrDefault,
  projectCategoriesByProjectId,
  projectCategoryByIdOrDefault,
  projectCategoryCardsForDisplayChildren,
  updateCategory,
} from "@will-be-done/slices/space";
import { PreloadedTaskComp } from "@/components/Task/Task.tsx";
import {
  buildFocusKey,
  focusTaskTitleTextareaByKey,
  prepareTextInputFocus,
  useFocusStore,
} from "@/store/focusSlice.ts";
import { cn } from "@/lib/utils.ts";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { DndModelData, isModelDNDData } from "@/lib/dnd/models.ts";
import invariant from "tiny-invariant";
import { promptDialog } from "@/components/ui/prompt-dialog-service";

const ArrowUp = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <path
      d="M4 7V1M1 4l3-3 3 3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowDown = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
    <path
      d="M4 1v6M1 4l3 3 3-3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg width="9" height="10" viewBox="0 0 9 10" fill="none">
    <path
      d="M7 2.5V8C7 8.276 6.776 8.5 6.5 8.5H2.5C2.224 8.5 2 8.276 2 8V2.5M1 2.5H8M3 2.5V1.5C3 1.224 3.224 1 3.5 1H5.5C5.776 1 6 1.224 6 1.5V2.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CategorySection = ({
  categoryId,
  projectId,
}: {
  categoryId: string;
  projectId: string;
}) => {
  const dispatch = useAsyncDispatch();
  const columnRef = useRef<HTMLDivElement>(null);
  const [isDndOver, setIsDndOver] = useState(false);
  const [isPlaceholderFocused, setIsPlaceholderFocused] = useState(false);

  const { data: category } = useAsyncSelector({
    selector: projectCategoryByIdOrDefault,
    args: { id: categoryId },
  });

  const { data: cardsForDisplay = [] } = useAsyncSelector({
    selector: projectCategoryCardsForDisplayChildren,
    args: { projectCategoryId: category?.id ?? categoryId },
  });

  const [isShowMore, setIsShowMore] = useState(false);
  const { data: doneCardsForDisplay = [] } = useAsyncSelector({
    selector: doneProjectCategoryCardsForDisplay,
    args: { projectCategoryId: categoryId, limited: !isShowMore },
  });

  useEffect(() => {
    if (!category) return;
    invariant(columnRef.current);
    return dropTargetForElements({
      element: columnRef.current,
      getData: (): DndModelData => ({
        modelId: categoryId,
        modelType: category.type,
      }),
      canDrop: ({ source }) => {
        const data = source.data;
        if (!isModelDNDData(data)) return false;
        return true;
      },
      getIsSticky: () => true,
      onDragEnter: () => setIsDndOver(true),
      onDragLeave: () => setIsDndOver(false),
      onDragStart: () => setIsDndOver(true),
      onDrop: () => setIsDndOver(false),
    });
  }, [category, categoryId]);

  const visibleDoneIds = useMemo(() => {
    if (isShowMore) return doneCardsForDisplay;
    return doneCardsForDisplay.slice(0, 3);
  }, [doneCardsForDisplay, isShowMore]);

  const handleTitleClick = async () => {
    if (!category) return;
    const newTitle = await promptDialog("Section name", category.title);
    if (newTitle == null || newTitle === "") return;
    await dispatch(
      updateCategory({ categoryId, category: { title: newTitle } }),
    );
  };

  const handleAddTask = () => {
    prepareTextInputFocus();

    void (async () => {
      const task = await dispatch(
        createProjectCategoryTask({ categoryId, position: "prepend" }),
      );
      const focusKey = buildFocusKey(task.id, "task");
      useFocusStore.getState().editByKey(focusKey);

      if (focusTaskTitleTextareaByKey(focusKey)) return;

      window.requestAnimationFrame(() => {
        focusTaskTitleTextareaByKey(focusKey);
      });
    })();
  };

  const handleDelete = () => {
    if (!category) return;
    if (confirm(`Delete category "${category.title}"?`)) {
      void dispatch(deleteCategories({ ids: [categoryId] }));
    }
  };

  if (!category) return null;

  return (
    <div className="mb-5">
      {/* Category header */}
      <div
        className={cn(
          "flex items-center gap-1 mb-2 px-1 rounded-md transition-all",
          {
            "ring-2 ring-accent": isDndOver || isPlaceholderFocused,
          },
        )}
      >
        <button
          type="button"
          onClick={() => void handleTitleClick()}
          className="text-xs uppercase text-subheader font-semibold flex-1 min-w-0 text-left hover:text-primary transition-colors cursor-pointer truncate py-0.5"
        >
          {category.title || <span className="opacity-40">Untitled</span>}
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => void dispatch(moveLeft({ categoryId: categoryId }))}
            className="w-5 h-5 flex items-center justify-center text-content-tinted hover:text-primary transition-colors cursor-pointer rounded"
            title="Move up"
          >
            <ArrowUp />
          </button>
          <button
            type="button"
            onClick={() => void dispatch(moveRight({ categoryId: categoryId }))}
            className="w-5 h-5 flex items-center justify-center text-content-tinted hover:text-primary transition-colors cursor-pointer rounded"
            title="Move down"
          >
            <ArrowDown />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-5 h-5 flex items-center justify-center text-content-tinted hover:text-notice transition-colors cursor-pointer rounded"
            title="Delete category"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Add task button */}
      <button
        type="button"
        onClick={handleAddTask}
        className="w-full flex items-center justify-center gap-2 text-sm text-content-tinted/60 hover:text-content-tinted py-1.5 mb-2 transition-colors group/add cursor-pointer"
      >
        <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center flex-shrink-0 opacity-60 group-hover/add:opacity-100 transition-opacity">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M4 1v6M1 4h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span>Add task</span>
      </button>

      <div
        ref={columnRef}
        data-focus-column
        data-column-model-id={categoryId}
        data-column-model-type={category.type}
        className="relative"
      >
        <div className="flex flex-col gap-2">
          {cardsForDisplay.map((displayData) => (
            <PreloadedTaskComp
              key={displayData.cardWrapper.id}
              card={displayData.card}
              category={displayData.category}
              cardWrapper={displayData.cardWrapper}
              project={displayData.project}
              lastScheduleTime={displayData.lastScheduleTime}
              displayedUnderProjectId={projectId}
              hasCheclistItems={displayData.hasChecklist}
              displayLastScheduleTime
            />
          ))}
          {visibleDoneIds.map((displayData) => (
            <PreloadedTaskComp
              key={displayData.cardWrapper.id}
              card={displayData.card}
              category={displayData.category}
              cardWrapper={displayData.cardWrapper}
              project={displayData.project}
              lastScheduleTime={displayData.lastScheduleTime}
              displayedUnderProjectId={projectId}
              hasCheclistItems={displayData.hasChecklist}
              displayLastScheduleTime
            />
          ))}
          {!isShowMore && doneCardsForDisplay.length > 3 && (
            <button
              onClick={() => setIsShowMore(true)}
              className="cursor-pointer text-subheader text-sm px-1"
              type="button"
            >
              Show more ({doneCardsForDisplay.length - 3})
            </button>
          )}
        </div>
        <div
          data-focus-placeholder
          data-focusable-key={buildFocusKey(
            categoryId,
            category.type,
            "Column",
          )}
          tabIndex={0}
          className="absolute w-0 h-0 overflow-hidden outline-none"
          onFocus={() => setIsPlaceholderFocused(true)}
          onBlur={() => setIsPlaceholderFocused(false)}
          onKeyDown={(e) => {
            const noModifiers = !(e.shiftKey || e.ctrlKey || e.metaKey);
            if (noModifiers && (e.code === "KeyO" || e.code === "KeyA")) {
              e.preventDefault();
              handleAddTask();
            }
          }}
        />
      </div>
    </div>
  );
};

const AddSectionButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-center gap-2 text-sm text-content-tinted/50 hover:text-content-tinted py-1.5 mt-1 transition-colors group/sec cursor-pointer"
  >
    <span className="w-4 h-4 rounded border border-current flex items-center justify-center flex-shrink-0 opacity-50 group-hover/sec:opacity-100 transition-opacity">
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path
          d="M4 1v6M1 4h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
    <span>Add section</span>
  </button>
);

export const ProjectTaskPanel = ({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) => {
  const dispatch = useAsyncDispatch();
  const { data: project } = useAsyncSelector({
    selector: projectByIdOrDefault,
    args: { id: projectId },
  });

  const { data: categories = [] } = useAsyncSelector({
    selector: projectCategoriesByProjectId,
    args: { projectId: projectId },
  });

  const handleAddSection = async () => {
    const title = await promptDialog("Section name");
    if (!title) return;
    await dispatch(
      createCategory({
        categoryDraft: { projectId, title },
        position: "append",
      }),
    );
  };

  if (embedded) {
    return (
      <div data-focus-region-direction="column" className="flex flex-col gap-1">
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            categoryId={cat.id}
            projectId={projectId}
          />
        ))}
        <AddSectionButton onClick={() => void handleAddSection()} />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 shrink-0">
        <span className="text-base">{project.icon || "🟡"}</span>
        <span className="text-sm font-semibold text-content truncate">
          {project.title}
        </span>
      </div>
      <div
        data-focus-region-direction="column"
        className="flex-1 overflow-y-auto px-3 pb-4"
      >
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            categoryId={cat.id}
            projectId={projectId}
          />
        ))}
        <AddSectionButton onClick={() => void handleAddSection()} />
      </div>
    </div>
  );
};
