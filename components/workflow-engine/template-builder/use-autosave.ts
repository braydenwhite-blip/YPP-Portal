"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved";

/** Debounced-save hook for the builder's inline editors. Give the panel a
 *  `key={record.id}` so React remounts (and re-seeds `initialValue`) when the
 *  user switches records — this hook intentionally does not sync prop changes
 *  itself, to avoid clobbering an in-flight edit. */
export function useAutosave<T>(
  initialValue: T,
  save: (value: T) => Promise<void>,
  delayMs = 600
) {
  const [value, setValueState] = useState(initialValue);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;

  const runSave = useCallback(() => {
    setStatus("saving");
    saveRef.current(latestValueRef.current).then(
      () => setStatus("saved"),
      () => setStatus("idle")
    );
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    runSave();
  }, [runSave]);

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const next = typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        latestValueRef.current = next;
        return next;
      });
      setStatus("idle");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(runSave, delayMs);
    },
    [delayMs, runSave]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { value, setValue, status, flush };
}
