import { useEffect, type RefObject } from "react";
import { create } from "zustand";
import { taskType } from "@will-be-done/slices/space";
import { buildFocusKey, useFocusStore } from "@/store/focusSlice";

type ProjectTaskReveal = {
  projectId: string;
  sectionId: string;
  taskId: string;
};

const useProjectTaskRevealStore = create<{
  request: ProjectTaskReveal | null;
}>(() => ({ request: null }));

export function requestProjectTaskReveal(request: ProjectTaskReveal) {
  useProjectTaskRevealStore.setState({ request });
}

/** Wait for the requested project task to render before selecting and scrolling. */
export function useProjectTaskReveal({
  projectId,
  rootRef,
}: {
  projectId: string;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const request = useProjectTaskRevealStore((state) =>
    state.request?.projectId === projectId ? state.request : null,
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!request || !root) return;

    const clearRequest = () => {
      if (useProjectTaskRevealStore.getState().request === request)
        useProjectTaskRevealStore.setState({ request: null });
    };
    const focusKey = buildFocusKey(request.taskId, taskType);
    const revealTask = () => {
      if (useProjectTaskRevealStore.getState().request !== request) return;
      const task = root.querySelector<HTMLElement>(
        `[data-task-sort-view="project:${projectId}"] [data-focusable-key="${focusKey}"]`,
      );
      if (!task?.getClientRects().length) return;

      observer.disconnect();
      useFocusStore.getState().focusByKey(focusKey, true);
      task.focus({ preventScroll: true });
      task.scrollIntoView({ block: "center", inline: "center" });
      clearRequest();
    };
    const observer = new MutationObserver(revealTask);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    revealTask();

    return () => {
      observer.disconnect();
      clearRequest();
    };
  }, [projectId, request, rootRef]);

  return request?.sectionId;
}
