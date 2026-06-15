"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

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

/**
 * Renders its children only in Executive mode. Use this to hide dense extras in
 * Calm mode — metric tile rows, extra lanes, secondary context — so Calm shows
 * the one obvious next move and a few supporting items, nothing more.
 */
export function ExecutiveOnly({ children }: { children: ReactNode }) {
  return useIsExecutive() ? <>{children}</> : null;
}

/**
 * Density-aware collapse. In Calm mode the children are tucked into a collapsed
 * disclosure (advanced panels hidden until asked for); in Executive mode they
 * render inline. Keeps Calm to a single focus + a few supporting items while
 * keeping everything one click away.
 */
export function CalmCollapse({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const executive = useIsExecutive();
  if (executive) return <>{children}</>;
  return (
    <details className="group rounded-[14px] border border-line-soft bg-surface/70 shadow-card [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-ink">{label}</span>
          {hint ? <span className="text-[12px] text-ink-muted">{hint}</span> : null}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-700">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="transition-transform duration-200 group-open:rotate-180"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="border-t border-line-soft p-4">{children}</div>
    </details>
  );
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
