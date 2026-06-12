"use client";

import { useState } from "react";
import ApplicantDocumentsPanel from "./ApplicantDocumentsPanel";
import ApplicantTimelineFeed from "./ApplicantTimelineFeed";
import type { ApplicantDocumentKind } from "@prisma/client";

interface SidebarTimelineEvent {
  id: string;
  kind: string;
  createdAt: Date;
  actorId: string | null;
  payload: unknown;
  actor?: { id: string; name: string | null } | null;
}

interface Props {
  application: {
    id: string;
    applicationTrack?: string | null;
    documents: Array<{
      id: string;
      kind: ApplicantDocumentKind;
      fileUrl: string;
      originalName: string | null;
      note: string | null;
      uploadedAt: Date;
      supersededAt: Date | null;
    }>;
    timeline: SidebarTimelineEvent[];
  };
}

export default function ApplicantCockpitSidebar({
  application,
}: Props) {
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const previewEvents = application.timeline.slice(0, 5);

  // Normalise timeline events for the feed component
  function toFeedEvents(evts: SidebarTimelineEvent[]) {
    return evts.map((e) => ({
      id: e.id,
      kind: e.kind,
      createdAt: e.createdAt,
      payload: (e.payload ?? {}) as Record<string, unknown>,
      actor: e.actor,
    }));
  }

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-[60px]">
      {/* Documents — not applicable for Summer Workshop applicants */}
      {application.applicationTrack !== "SUMMER_WORKSHOP_INSTRUCTOR" && (
        <section id="sidebar-documents">
          <ApplicantDocumentsPanel
            applicationId={application.id}
            documents={application.documents}
            canUpload
          />
        </section>
      )}

      {/* Timeline preview */}
      <section className="rounded-[12px] border border-line-soft bg-surface p-[18px] shadow-card">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="m-0 text-[14px] font-bold text-ink">Recent Activity</h3>
          {application.timeline.length > 5 && (
            <button
              type="button"
              className="cursor-pointer rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-ink"
              onClick={() => setShowAllTimeline(!showAllTimeline)}
            >
              {showAllTimeline ? "Show less" : `See all (${application.timeline.length})`}
            </button>
          )}
        </div>
        <ApplicantTimelineFeed
          events={toFeedEvents(showAllTimeline ? application.timeline : previewEvents)}
        />
      </section>
    </aside>
  );
}
