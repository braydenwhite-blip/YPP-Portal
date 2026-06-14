"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { CommandPaletteShell, cn } from "@/components/ui-v2";

import { HelpAgentSearch } from "./help-agent-search";

/**
 * YPP Help Agent — global provider. Mounts the ⌘K / Ctrl+K palette once in
 * the app shell (inside Entity360Provider, so results open 360 previews) and
 * exposes `useHelpAgent()` to triggers anywhere in the chrome.
 */

type HelpAgentApi = { open: () => void; close: () => void };

const HelpAgentContext = createContext<HelpAgentApi | null>(null);

export function useHelpAgent(): HelpAgentApi | null {
  return useContext(HelpAgentContext);
}

export function HelpAgentProvider({
  officerTier,
  adminTier = false,
  children,
}: {
  /** Computed server-side from the session roles (OFFICER_TIER_ROLES). */
  officerTier: boolean;
  /** Used only to hide admin-only shortcuts from non-admin officers. */
  adminTier?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const api = useMemo(() => ({ open, close }), [open, close]);

  // The global shortcut. (The sidebar nav filter used to own ⌘K; the Help
  // Agent is the portal-wide standard now.)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close on route change (e.g. a suggestion navigated).
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <HelpAgentContext.Provider value={api}>
      {children}
      <CommandPaletteShell open={isOpen} onClose={close} label="YPP Help Agent">
        <HelpAgentSearch
          officerTier={officerTier}
          adminTier={adminTier}
          variant="palette"
          onDone={close}
        />
      </CommandPaletteShell>
    </HelpAgentContext.Provider>
  );
}

/**
 * Sidebar trigger for the YPP Help Agent (⌘K).
 */
export function HelpAgentTrigger({ className }: { className?: string }) {
  const api = useHelpAgent();
  if (!api) return null;
  return (
    <button
      type="button"
      onClick={api.open}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] border border-[rgba(99,102,241,0.14)] bg-[rgba(255,255,255,0.92)] px-3 py-2",
        "text-left text-[13px] font-medium text-[var(--text-secondary)] shadow-[0_1px_3px_rgba(59,15,110,0.06)]",
        "transition-colors duration-150 hover:border-[rgba(99,102,241,0.22)] hover:bg-white hover:text-[var(--nav-purple-800)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(99,102,241,0.45)]",
        className
      )}
      aria-label="Open YPP Help Agent (⌘K)"
    >
      <span aria-hidden className="text-[14px]">
        ⌕
      </span>
      <span className="flex-1 truncate">Search YPP…</span>
      <kbd
        aria-hidden
        className="rounded border border-[rgba(99,102,241,0.15)] bg-[rgba(99,102,241,0.06)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--nav-purple-500)]"
      >
        ⌘K
      </kbd>
    </button>
  );
}
