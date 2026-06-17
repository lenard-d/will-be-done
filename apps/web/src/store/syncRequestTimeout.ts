const SYNC_REQUEST_TIMEOUT_MS = 30_000;

class SyncRequestTimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out after ${SYNC_REQUEST_TIMEOUT_MS}ms`);
    this.name = "SyncRequestTimeoutError";
  }
}

export const withSyncRequestTimeout = async <T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new SyncRequestTimeoutError(label));
  }, SYNC_REQUEST_TIMEOUT_MS);

  try {
    return await run(controller.signal);
  } finally {
    window.clearTimeout(timeoutId);
  }
};
