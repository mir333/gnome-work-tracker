import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Generic data-refresh mechanism shared by all screens.
 *
 * - Pages register a refresh handler with `useRefresh(handler)`.
 * - `refresh()` runs every registered handler concurrently (manual refresh
 *   button in the nav bar uses this).
 * - When the browser tab / window regains focus, all handlers run
 *   automatically (throttled so that the paired `focus` +
 *   `visibilitychange` events and rapid tab switching don't spam the API).
 */

export type RefreshHandler = () => unknown | Promise<unknown>;

/** Minimum gap between automatic (focus-triggered) refreshes. */
const FOCUS_REFRESH_MIN_INTERVAL_MS = 5_000;

interface RefreshContextValue {
  refresh: () => Promise<void>;
  refreshing: boolean;
  register: (handler: React.RefObject<RefreshHandler>) => () => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Set<React.RefObject<RefreshHandler>>());
  const inFlight = useRef<Promise<void> | null>(null);
  const lastRefreshAt = useRef(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    // Coalesce concurrent requests into a single run.
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      setRefreshing(true);
      try {
        const results = await Promise.allSettled(
          [...handlers.current].map((h) => h.current()),
        );
        for (const r of results) {
          if (r.status === "rejected") {
            console.error("Data refresh failed:", r.reason);
          }
        }
      } finally {
        lastRefreshAt.current = Date.now();
        inFlight.current = null;
        setRefreshing(false);
      }
    })();

    inFlight.current = run;
    return run;
  }, []);

  const register = useCallback(
    (handler: React.RefObject<RefreshHandler>) => {
      handlers.current.add(handler);
      return () => {
        handlers.current.delete(handler);
      };
    },
    [],
  );

  // Refresh when the tab/window regains focus.
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState !== "visible") return;
      if (handlers.current.size === 0) return;
      if (Date.now() - lastRefreshAt.current < FOCUS_REFRESH_MIN_INTERVAL_MS) {
        return;
      }
      void refresh();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ refresh, refreshing, register }),
    [refresh, refreshing, register],
  );

  return (
    <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
  );
}

function useRefreshContext(): RefreshContextValue {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("useRefresh must be used within a <RefreshProvider>");
  }
  return ctx;
}

/**
 * Register a handler that reloads the current screen's data. It is invoked
 * by the manual refresh button and whenever the tab regains focus.
 *
 * The latest handler is always called, so it may freely close over current
 * state (selected date, active tab, …) without needing to be memoised.
 */
export function useRefresh(handler: RefreshHandler) {
  const { register } = useRefreshContext();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => register(handlerRef), [register]);
}

/** Access the manual `refresh()` trigger and the in-progress flag. */
export function useRefreshControl() {
  const { refresh, refreshing } = useRefreshContext();
  return { refresh, refreshing };
}
