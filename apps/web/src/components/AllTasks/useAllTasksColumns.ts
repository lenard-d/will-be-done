import { useMemo } from "react";
import {
  useAsyncDispatch,
  useAsyncSelector,
} from "@will-be-done/hyperdb/react";
import {
  allTasksColumns,
  allTasksColumnType,
  defaultAllTasksColumnId,
  ensureAllTasksColumns,
  type AllTasksColumn,
} from "@will-be-done/slices/space";
import { readLegacyTaskFilters } from "./legacyTaskFilters";

export function useAllTasksColumns(spaceId: string) {
  const dispatch = useAsyncDispatch();
  const legacyFilters = useMemo(
    () => readLegacyTaskFilters(spaceId),
    [spaceId],
  );
  const filtersJson = JSON.stringify(legacyFilters);
  const result = useAsyncSelector({ selector: allTasksColumns, args: {} });
  const defaultColumn: AllTasksColumn = {
    type: allTasksColumnType,
    id: defaultAllTasksColumnId,
    title: "Tasks",
    orderToken: "a0",
    createdAt: 0,
    filtersJson,
  };
  return {
    columns: result.data?.length ? result.data : [defaultColumn],
    isFetching: result.isFetching,
    error: result.error,
    // Persist on an explicit change. Opening a new device must not overwrite
    // columns that its first server sync has not downloaded yet.
    ensureColumns: () => dispatch(ensureAllTasksColumns({ filtersJson })),
  };
}
