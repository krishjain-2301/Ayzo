"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "./api";

/**
 * Load an endpoint, and reload it every `everyMs` while `everyMs` is set.
 * Returns the data, any error text, and a reload function.
 */
export function useApi<T>(endpoint: string | null, every?: number | null | ((data: T | null) => number | null)) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(endpoint));
  const latest = useRef(endpoint);
  // A function lets a caller stop polling once the data says the work is done.
  const everyMs = typeof every === "function" ? every(data) : every;

  const reload = useCallback(async () => {
    if (!endpoint) return;
    try {
      const result = await apiFetch<T>(endpoint);
      if (latest.current === endpoint) {
        setData(result);
        setError("");
      }
    } catch (e) {
      if (latest.current === endpoint) setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      if (latest.current === endpoint) setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    latest.current = endpoint;
    // Loading on mount and on a timer is the purpose of this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
    if (!everyMs) return;
    const timer = setInterval(reload, everyMs);
    return () => clearInterval(timer);
  }, [endpoint, everyMs, reload]);

  return { data, error, loading, reload, setData };
}
