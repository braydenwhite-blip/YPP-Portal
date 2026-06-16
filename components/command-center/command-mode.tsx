"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/components/ui-v2";

/**
 * Calm / Executive mode — a lightweight UI density preference shared across the
 * operating surfaces. Calm (default) shows the one obvious next move and a few
 * items; Executive reveals more context and longer lanes.
 *
 * The preference is stored in localStorage so it sticks across visits. Every
 * provider instance — the one global provider in the app shell plus any local
 * provider a surface still wraps itself in — listens for a window event, so a
 * change anywhere (the global top-bar pill, or a surface's own pill) is applied
 * everywhere live, and across browser tabs via the `storage` event. Each
 * provider keeps its own state, so a surface mounted without the shell still
 * falls back to a working local pill.
 */

export type CommandMode = "calm" | "executive";

const STORAGE_KEY = "ypp:command-mode";
/** Same-tab broadcast so every provider stays in sync without a navigation. */
const MODE_EVENT = "ypp:command-mode-change";

function isMode(value: unknown): value is CommandMode {
  return value === "calm" || value === "executive";
}

function readStoredMode(): CommandMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isMode(stored)) return stored;
  } catch {
    // localStorage unavailable — keep the calm default.
  }
  return "calm";
}

const CommandModeContext = createContext<{
  mode: CommandMode;
  setMode: (mode: CommandMode) => void;
}>({ mode: "calm", setMode: () => {} });

export function CommandModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<CommandMode>("calm");

  useEffect(() => {
    // Hydrate from the stored preference, then keep in sync with any other
    // provider (same tab via MODE_EVENT, other tabs via the storage event).
    setModeState(readStoredMode());

    function onModeEvent(event: Event) {
      const next = (event as CustomEvent<CommandMode>).detail;
      if (isMode(next)) setModeState(next);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && isMode(event.newValue)) setModeState(event.newValue);
    }

    window.addEventListener(MODE_EVENT, onModeEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MODE_EVENT, onModeEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setMode = useCallback((next: CommandMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence failures
    }
    try {
      // Broadcast so sibling / parent providers update without a reload.
      window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: next }));
    } catch {
      // CustomEvent unavailable (very old runtime) — localStorage still sticks.
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
 * Renders its children only in Calm mode. The mirror of {@link ExecutiveOnly} —
 * use it for the calm summary (one focus + a short list) that a denser Executive
 * panel supersedes, so the two don't stack.
 */
export function CalmOnly({ children }: { children: ReactNode }) {
  return useIsExecutive() ? null : <>{children}</>;
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
