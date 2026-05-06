"use client";

import { useEffect, useRef, useState } from "react";

function format(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function useInterviewTimer(initiallyRunning = false) {
  const [running, setRunning] = useState(initiallyRunning);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    startRef.current = Date.now();
    const interval = setInterval(() => {
      if (startRef.current == null) return;
      const now = Date.now();
      setElapsed(accumulatedRef.current + Math.floor((now - startRef.current) / 1000));
    }, 500);
    return () => {
      clearInterval(interval);
      if (startRef.current != null) {
        accumulatedRef.current += Math.floor((Date.now() - startRef.current) / 1000);
        startRef.current = null;
      }
    };
  }, [running]);

  function reset() {
    accumulatedRef.current = 0;
    startRef.current = running ? Date.now() : null;
    setElapsed(0);
  }

  return {
    elapsed,
    label: format(elapsed),
    running,
    start: () => setRunning(true),
    pause: () => setRunning(false),
    toggle: () => setRunning((value) => !value),
    reset,
  };
}
