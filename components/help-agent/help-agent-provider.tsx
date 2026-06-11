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
  children,
}: {
  /** Computed server-side from the session roles (OFFICER_TIER_ROLES). */
  officerTier: boolean;
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
          variant="palette"
          onDone={close}
        />
      </CommandPaletteShell>
    </HelpAgentContext.Provider>
  );
}

/**
 * The dark-sidebar trigger. Styled for the premium sidebar surface; renders
 * nothing when the provider is absent (progressive enhancement).
 */
export function HelpAgentTrigger({ className }: { className?: string }) {
  const api = useHelpAgent();
  if (!api) return null;
  return (
    <button
      type="button"
      onClick={api.open}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.07] px-3 py-2",
        "text-left text-[13px] font-medium text-white/80 transition-colors duration-150",
        "hover:border-white/25 hover:bg-white/[0.12] hover:text-white",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400",
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
        className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70"
      >
        ⌘K
      </kbd>
    </button>
  );
}
