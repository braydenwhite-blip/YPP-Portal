"use client";

import { useRouter } from "next/navigation";

import { useHelpAgent } from "@/components/help-agent/help-agent-provider";

/**
 * Home cockpit Help Agent entry: opens the global ⌘K palette in place;
 * falls back to the /help-agent page when no provider is mounted.
 */
export function HomeSearchButton() {
  const helpAgent = useHelpAgent();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (helpAgent) helpAgent.open();
        else router.push("/help-agent");
      }}
      className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-4 py-2.5 text-left shadow-card transition-colors duration-150 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 sm:w-80"
    >
      <span aria-hidden className="text-[15px] leading-none opacity-60">
        🔎
      </span>
      <span className="flex-1 truncate text-[13.5px] text-ink-muted">
        Find anyone or anything…
      </span>
      <kbd className="rounded-[6px] border border-line bg-surface-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">
        ⌘K
      </kbd>
    </button>
  );
}
