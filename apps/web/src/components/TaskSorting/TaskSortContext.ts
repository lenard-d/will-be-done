import { createContext, use } from "react";
import type { TaskSortMode } from "./taskSorting";

type TaskSortContextValue = {
  mode: TaskSortMode;
  dailyListId?: string;
  previousTaskId?: string;
  nextTaskId?: string;
  calendar: boolean;
  blockManual: boolean;
};

export const TaskSortingContext = createContext<
  TaskSortContextValue | undefined
>(undefined);
export const useTaskSortContext = () => use(TaskSortingContext);
