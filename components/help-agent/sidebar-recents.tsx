"use client";

import { useEffect, useState } from "react";

import { useEntity360 } from "@/components/operations/entity-360-context";
import { cn, sidebarSectionTitleClass } from "@/components/ui-v2";
import type { HelpAgentResult, HelpAgentSearchResponse } from "@/lib/help-agent/types";
import type { Entity360Type } from "@/lib/operations/entity-360";

const TYPE_ICON: Record<Entity360Type, string> = {
  person: "👤",
  class: "📚",
  partner: "🤝",
  initiative: "🚩",
  meeting: "📅",
  action: "✅",
  mentorship: "🔄",
  applicant: "📋",
};

/**
 * Sidebar "Recently Viewed" (master plan §22.4): the viewer's last few
 * Entity 360 opens, one click back into the preview drawer. Reads the same
 * recents the Help Agent serves on an empty query (RecentEntityView, written
 * by /api/entity-360), so the sidebar and palette never disagree. Renders
 * nothing while loading, on failure, or when there is no history — the
 * sidebar must never block on this.
 */
export function SidebarRecents({ limit = 4 }: { limit?: number }) {
  const entity360 = useEntity360();
  const [recents, setRecents] = useState<HelpAgentResult[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search?q=", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("recents unavailable");
        return (await res.json()) as HelpAgentSearchResponse;
      })
      .then((data) => setRecents((data.recents ?? []).slice(0, limit)))
      .catch(() => {});
    return () => controller.abort();
  }, [limit]);

  if (!entity360 || recents.length === 0) return null;

  return (
    <section aria-label="Recently viewed">
      <p className={sidebarSectionTitleClass}>Recently Viewed</p>
      <div className="flex flex-col gap-0.5">
        {recents.map((item) => (
          <button
            key={`${item.type}:${item.id}`}
            type="button"
            onClick={() => entity360.openEntity(item.type, item.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left",
              "text-[12.5px] font-medium text-white/65 transition-colors duration-150",
              "hover:bg-white/[0.08] hover:text-white",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
            )}
            title={`Open ${item.title}`}
          >
            <span aria-hidden className="text-[12px] leading-none opacity-80">
              {TYPE_ICON[item.type]}
            </span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
