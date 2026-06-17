"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/components/ui-v2";
import {
  COMMAND_MODE_COOKIE,
  COMMAND_MODE_EVENT,
  COMMAND_MODE_STORAGE_KEY,
  DEFAULT_COMMAND_MODE,
  isCommandMode,
  type CommandMode,
} from "@/lib/command-mode-cookie";

/**
 * Calm / Executive mode — the ONE global view mode for the whole portal.
 *
 * Calm (the default) shows the single obvious next move and a few items so
 * nobody is ever overwhelmed. Executive reveals the full operating picture —
 * tables, metrics, every lane. It is a product mode, not a theme: pages render
 * a genuinely simpler experience in Calm and the full detail in Executive.
 *
 * Single source of truth, three guarantees:
 *   1. No drift — a provider that detects another provider above it defers to
 *      that parent instead of holding its own state, so the global top-bar pill
 *      and every surface always agree. A surface mounted standalone (a test, an
 *      embed) still gets a working local provider because there is no parent.
 *   2. No flash — the server reads the {@link COMMAND_MODE_COOKIE} cookie and
 *      passes `initialMode`, so the first paint already matches the user's
 *      choice. Executive never flashes through Calm (or vice-versa).
 *   3. Persistence — a change writes the cookie (for the next server render) and
 *      localStorage (for cross-tab sync and returning visitors), and broadcasts
 *      so every live consumer updates without a navigation.
 */

export type { CommandMode };

type CommandModeContextValue = {
  mode: CommandMode;
  setMode: (mode: CommandMode) => void;
  /** Sentinel: a real provider is mounted above. Lets nested providers defer. */
  hasProvider: boolean;
};

const CommandModeContext = createContext<CommandModeContextValue>({
  mode: DEFAULT_COMMAND_MODE,
  setMode: () => {},
  hasProvider: false,
});

function readStoredMode(): CommandMode | null {
  try {
    const stored = window.localStorage.getItem(COMMAND_MODE_STORAGE_KEY);
    return isCommandMode(stored) ? stored : null;
  } catch {
    return null;
  }
}

function persistMode(mode: CommandMode) {
  try {
    window.localStorage.setItem(COMMAND_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage unavailable — the cookie below still carries the choice.
  }
  try {
    // A view-density preference, not sensitive; site-wide, one year, lax.
    document.cookie = `${COMMAND_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // ignore
  }
}

export function CommandModeProvider({
  children,
  initialMode,
}: {
  children: ReactNode;
  /** Server-supplied mode from the cookie, so the first paint is flash-free. */
  initialMode?: CommandMode;
}) {
  const parent = useContext(CommandModeContext);
  const isNested = parent.hasProvider;

  const [mode, setModeState] = useState<CommandMode>(initialMode ?? DEFAULT_COMMAND_MODE);
  const hadInitial = useRef(initialMode != null);

  useEffect(() => {
    // Only the root provider owns persistence + sync; nested ones defer fully.
    if (isNested) return;

    // First visit before the cookie exists: a returning visitor may still have
    // the choice in localStorage. Adopt it (and seed the cookie) when the server
    // didn't already tell us the mode, so we converge without a future flash.
    if (!hadInitial.current) {
      const stored = readStoredMode();
      if (stored && stored !== mode) {
        setModeState(stored);
        persistMode(stored);
      } else {
        persistMode(mode);
      }
    } else {
      persistMode(mode);
    }

    function onModeEvent(event: Event) {
      const next = (event as CustomEvent<CommandMode>).detail;
      if (isCommandMode(next)) setModeState(next);
    }
    function onStorage(event: StorageEvent) {
      if (event.key === COMMAND_MODE_STORAGE_KEY && isCommandMode(event.newValue)) {
        setModeState(event.newValue);
      }
    }
    window.addEventListener(COMMAND_MODE_EVENT, onModeEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COMMAND_MODE_EVENT, onModeEvent);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNested]);

  const setMode = useCallback((next: CommandMode) => {
    setModeState(next);
    persistMode(next);
    try {
      window.dispatchEvent(new CustomEvent(COMMAND_MODE_EVENT, { detail: next }));
    } catch {
      // CustomEvent unavailable — localStorage + cookie still stick.
    }
  }, []);

  // A provider mounted inside another defers entirely to the parent: one source
  // of truth, zero drift. Hooks above still run (rules of hooks), but their
  // state is unused — consumers read the parent's value through this passthrough.
  if (isNested) return <>{children}</>;

  return (
    <CommandModeContext.Provider value={{ mode, setMode, hasProvider: true }}>
      {children}
    </CommandModeContext.Provider>
  );
}

export function useCommandMode() {
  const { mode, setMode } = useContext(CommandModeContext);
  return { mode, setMode };
}

/** True when the executive (denser, more context) view is active. */
export function useIsExecutive(): boolean {
  return useContext(CommandModeContext).mode === "executive";
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
 *
 * `defaultOpen` starts the disclosure expanded (still toggleable). Use it when a
 * Calm surface deep-links into its own demoted detail — e.g. a triage card that
 * jumps to a specific tab — so the target is visible on arrival instead of
 * hidden behind "Show".
 */
export function CalmCollapse({
  label,
  hint,
  children,
  defaultOpen = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const executive = useIsExecutive();
  if (executive) return <>{children}</>;
  return (
    <details
      open={defaultOpen}
      className="group rounded-[14px] border border-line-soft bg-surface/70 shadow-card [&_summary::-webkit-details-marker]:hidden"
    >
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
export function CommandModeToggle({
  className,
  compact = false,
}: {
  className?: string;
  /** Narrow chrome (mobile top bar) — tighter padding, same two clear labels. */
  compact?: boolean;
}) {
  const { mode, setMode } = useCommandMode();
  return (
    <div
      role="radiogroup"
      aria-label="View density — Calm shows the essentials, Executive shows the full detail"
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
              "inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors",
              compact ? "px-2.5 py-1 text-[12px]" : "px-3 py-1 text-[12.5px]",
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
