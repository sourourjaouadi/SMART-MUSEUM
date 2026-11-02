export function createRefreshScheduler(
  refresh,
  intervalMs,
  { setIntervalFn = setInterval, clearIntervalFn = clearInterval, onError } = {},
) {
  let intervalId;
  let inFlight = false;
  let stopped = true;

  async function runRefresh() {
    if (stopped || inFlight) {
      return;
    }

    inFlight = true;
    try {
      await refresh();
    } catch (error) {
      onError?.(error);
    } finally {
      inFlight = false;
    }
  }

  return {
    start() {
      if (!stopped) {
        return;
      }

      stopped = false;
      void runRefresh();
      intervalId = setIntervalFn(() => void runRefresh(), intervalMs);
    },
    stop() {
      if (stopped) {
        return;
      }

      stopped = true;
      clearIntervalFn(intervalId);
    },
  };
}
