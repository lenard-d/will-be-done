import {
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useUnmount } from "@/utils";
import { registerPendingDraftFlush } from "@/store/pendingDraftFlushes";

const defaultIsEqual = <T>(left: T, right: T) => Object.is(left, right);

export function useDebouncedPersistedDraft<T>({
  value,
  persist,
  delay = 200,
  isEqual = defaultIsEqual<T>,
}: {
  value: T;
  persist: (value: T) => void | Promise<void>;
  delay?: number;
  isEqual?: (left: T, right: T) => boolean;
}) {
  const [draft, setDraftState] = useState<T>(value);
  const draftRef = useRef(value);
  const sourceRef = useRef(value);
  const lastSubmittedRef = useRef(value);
  const pendingSaveRef = useRef<Promise<void>>(Promise.resolve());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSaveTimeout = useCallback(() => {
    if (!saveTimeoutRef.current) return;

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
  }, []);

  const flushAndWait = useCallback(
    (valueToPersist = draftRef.current) => {
      clearSaveTimeout();

      if (
        isEqual(valueToPersist, sourceRef.current) ||
        isEqual(valueToPersist, lastSubmittedRef.current)
      ) {
        return pendingSaveRef.current;
      }

      lastSubmittedRef.current = valueToPersist;
      pendingSaveRef.current = Promise.resolve(persist(valueToPersist));
      return pendingSaveRef.current;
    },
    [clearSaveTimeout, isEqual, persist],
  );

  const flush = useCallback(() => {
    void flushAndWait();
  }, [flushAndWait]);

  const setDraft = useCallback((nextValue: SetStateAction<T>) => {
    const resolvedValue =
      typeof nextValue === "function"
        ? (nextValue as (previousValue: T) => T)(draftRef.current)
        : nextValue;

    draftRef.current = resolvedValue;
    setDraftState(resolvedValue);
  }, []);

  useLayoutEffect(() => {
    const previousSource = sourceRef.current;
    if (isEqual(previousSource, value)) return;

    const currentDraft = draftRef.current;
    const currentLastSubmitted = lastSubmittedRef.current;
    const draftMatchesPreviousSource = isEqual(currentDraft, previousSource);
    const draftMatchesSubmittedValue =
      isEqual(currentDraft, currentLastSubmitted) &&
      isEqual(value, currentLastSubmitted);

    sourceRef.current = value;

    if (!draftMatchesPreviousSource && !draftMatchesSubmittedValue) return;

    lastSubmittedRef.current = value;
    clearSaveTimeout();

    if (isEqual(currentDraft, value)) return;

    draftRef.current = value;
    setDraftState(value);
  }, [clearSaveTimeout, isEqual, value]);

  useEffect(() => {
    if (
      isEqual(draft, sourceRef.current) ||
      isEqual(draft, lastSubmittedRef.current)
    ) {
      clearSaveTimeout();
      return;
    }

    clearSaveTimeout();
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      flush();
    }, delay);

    return clearSaveTimeout;
  }, [clearSaveTimeout, delay, draft, flush, isEqual]);

  useEffect(() => registerPendingDraftFlush(flush), [flush]);

  useUnmount(flush);

  return {
    draft,
    setDraft,
    flush,
    flushAndWait,
  };
}
