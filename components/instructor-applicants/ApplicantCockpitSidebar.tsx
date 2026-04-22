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
    <aside className="applicant-cockpit-sidebar">
      {/* Documents */}
      <section id="sidebar-documents">
        <ApplicantDocumentsPanel
          applicationId={application.id}
          documents={application.documents}
          canUpload
        />
      </section>

      {/* Timeline preview */}
      <section className="cockpit-sidebar-card">
        <div className="cockpit-sidebar-card-header">
          <h3>Recent Activity</h3>
          {application.timeline.length > 5 && (
            <button
              type="button"
              className="button outline cockpit-tiny-button"
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
