"use client";

import { useState } from "react";
import ChairComparisonSlideout from "./ChairComparisonSlideout";

interface InterviewReview {
  id: string;
  reviewerId: string;
  recommendation: string | null;
  overallRating: string | null;
  summary: string | null;
  reviewer: { id: string; name: string | null };
  categories: Array<{ category: string; rating: string | null; notes: string | null }>;
}

interface Document {
  kind: string;
  fileUrl: string;
  originalName: string | null;
}

interface ApplicationRow {
  id: string;
  subjectsOfInterest: string | null;
  materialsReadyAt: Date | null;
  chairQueuedAt: Date | null;
  preferredFirstName: string | null;
  legalName: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapterId: string | null;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  applicationReviews: Array<{ summary: string | null; nextStep: string | null; notes: string | null; overallRating: string | null }>;
  interviewReviews: InterviewReview[];
  interviewerAssignments: Array<{ id: string; role: string; interviewer: { id: string; name: string | null } }>;
  documents: Document[];
}

interface Props {
  applications: ApplicationRow[];
  onRefresh: () => void;
}

const REC_COLORS: Record<string, string> = {
  ACCEPT: "#16a34a",
  ACCEPT_WITH_SUPPORT: "#7c3aed",
  HOLD: "#d97706",
  REJECT: "#dc2626",
};

export default function ChairQueueBoard({ applications, onRefresh }: Props) {
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Build chapter groups
  const chapters = Array.from(
    new Map(
      applications
        .filter((a) => a.applicant.chapter)
        .map((a) => [a.applicant.chapter!.id, a.applicant.chapter!.name])
    ).entries()
  );

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);

  const displayed = showAll
    ? applications
    : activeChapterId
    ? applications.filter((a) => a.applicant.chapterId === activeChapterId)
    : applications;

  function daysInQueue(app: ApplicationRow): number | null {
    if (!app.chairQueuedAt) return null;
    return Math.floor((Date.now() - new Date(app.chairQueuedAt).getTime()) / 86400000);
  }

  return (
    <div>
      {/* Chapter tabs + YPP-wide toggle */}
      <div
        role="tablist"
        aria-label="Filter by chapter"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #e5e7eb",
          overflowX: "auto",
          paddingBottom: 0,
        }}
      >
        <button
          role="tab"
          type="button"
          aria-selected={showAll}
          onClick={() => { setActiveChapterId(null); setShowAll(true); }}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: showAll ? 700 : 400,
            color: showAll ? "#6b21c8" : "var(--muted)",
            background: "none",
            border: "none",
            borderBottom: showAll ? "2px solid #6b21c8" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          YPP-wide ({applications.length})
        </button>
        {chapters.map(([chapId, chapName]) => {
          const count = applications.filter((a) => a.applicant.chapterId === chapId).length;
          const active = !showAll && activeChapterId === chapId;
          return (
            <button
              key={chapId}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => { setActiveChapterId(chapId); setShowAll(false); }}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                color: active ? "#6b21c8" : "var(--muted)",
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid #6b21c8" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {chapName} ({count})
            </button>
          );
        })}
      </div>

      {/* Application rows */}
      {displayed.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 14,
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          No applications in the chair queue.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayed.map((app) => {
            const days = daysInQueue(app);
            const displayName =
              app.preferredFirstName ?? app.legalName ?? app.applicant.name ?? "Applicant";
            const reviewerRec = app.applicationReviews[0];

            return (
              <button
                key={app.id}
                type="button"
                aria-label={`Open chair decision for ${displayName}`}
                onClick={() => setSelectedApp(app)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 18px",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6b21c8")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                {/* Name + chapter */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{displayName}</p>
                  {app.applicant.chapter && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                      {app.applicant.chapter.name}
                    </p>
                  )}
                </div>

                {/* Days in queue */}
                {days !== null && (
                  <span
                    className={`pill ${days > 7 ? "pill-attention" : "pill-info"}`}
                    style={{ fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {days}d in queue
                  </span>
                )}

                {/* Reviewer rec */}
                {reviewerRec?.nextStep && (
                  <span className="pill pill-purple" style={{ fontSize: 12, flexShrink: 0 }}>
                    {reviewerRec.nextStep.replace(/_/g, " ")}
                  </span>
                )}

                {/* Interviewer rec dots */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {app.interviewReviews.map((ir) => (
                    <span
                      key={ir.reviewerId}
                      title={`${ir.reviewer.name ?? "Interviewer"}: ${ir.recommendation ?? "—"}`}
                      style={{
                        display: "inline-block",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: ir.recommendation
                          ? (REC_COLORS[ir.recommendation] ?? "#9ca3af")
                          : "#e5e7eb",
                        border: "1px solid rgba(0,0,0,0.1)",
                      }}
                    />
                  ))}
                </div>

                <span style={{ color: "var(--muted)", fontSize: 16, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Comparison slideout */}
      {selectedApp && (
        <ChairComparisonSlideout
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onDecisionMade={() => {
            setSelectedApp(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
