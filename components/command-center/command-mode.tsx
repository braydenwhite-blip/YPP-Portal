"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { cn } from "@/components/ui-v2";

/**
 * Calm / Executive mode — a lightweight, local UI density preference for the
 * Command Center operating surfaces. Calm (default) shows the one obvious next
 * move and a few items; Executive reveals more context and longer lanes. The
 * preference is stored in localStorage so it sticks across visits, and it stays
 * scoped to these surfaces (no global shell change).
 */

export type CommandMode = "calm" | "executive";

const STORAGE_KEY = "ypp:command-mode";

const CommandModeContext = createContext<{
  mode: CommandMode;
  setMode: (mode: CommandMode) => void;
}>({ mode: "calm", setMode: () => {} });

export function CommandModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<CommandMode>("calm");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "calm" || stored === "executive") setModeState(stored);
    } catch {
      // localStorage unavailable — keep the calm default.
    }
  }, []);

  const setMode = useCallback((next: CommandMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
  }, []);

  return (
    <CommandModeContext.Provider value={{ mode, setMode }}>
      {children}
    </CommandModeContext.Provider>
  );
}

export function useCommandMode() {
  return useContext(CommandModeContext);
}

/** True when the executive (denser, more context) view is active. */
export function useIsExecutive(): boolean {
  return useCommandMode().mode === "executive";
}

/** The pill segmented control from the mockups (Calm · Executive). */
export function CommandModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useCommandMode();
  return (
    <div
      role="radiogroup"
      aria-label="View density"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line-soft bg-surface/80 p-0.5 shadow-card backdrop-blur",
        className
      )}
    >
      {(["calm", "executive"] as const).map((value) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors",
              active ? "bg-brand-600 text-white shadow-card" : "text-ink-muted hover:text-ink"
            )}
          >
            {value === "calm" ? (
              <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
            ) : null}
            {value === "calm" ? "Calm" : "Executive"}
          </button>
        );
      })}
    </div>
  );
}
