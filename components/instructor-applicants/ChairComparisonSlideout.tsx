"use client";

import { useTransition, useState } from "react";
import { chairDecide } from "@/lib/instructor-application-actions";
import DecisionReadinessChecklist from "./DecisionReadinessChecklist";
import type { ChairDecisionAction } from "@prisma/client";

interface Category {
  category: string;
  rating: string | null;
  notes: string | null;
}

interface InterviewReview {
  id: string;
  reviewer: { id: string; name: string | null };
  overallRating: string | null;
  recommendation: string | null;
  summary: string | null;
  categories: Category[];
}

interface Application {
  id: string;
  subjectsOfInterest: string | null;
  materialsReadyAt: Date | string | null;
  preferredFirstName: string | null;
  legalName: string | null;
  chairQueuedAt: Date | string | null;
  applicant: {
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { name: string | null } | null;
  applicationReviews: Array<{ summary: string | null; nextStep: string | null; notes: string | null }>;
  interviewReviews: InterviewReview[];
  documents: Array<{ kind: string; fileUrl: string; originalName: string | null }>;
}

interface Props {
  application: Application | null;
  onClose: () => void;
  onDecisionMade: () => void;
}

const ACTIONS: { value: ChairDecisionAction; label: string; cls: string }[] = [
  { value: "APPROVE", label: "Approve", cls: "button" },
  { value: "HOLD", label: "Hold", cls: "button outline" },
  { value: "REQUEST_INFO", label: "Request Info", cls: "button outline" },
  { value: "REQUEST_SECOND_INTERVIEW", label: "2nd Interview", cls: "button outline" },
  { value: "REJECT", label: "Reject", cls: "button" },
];

const REC_COLOR: Record<string, string> = {
  ACCEPT: "#16a34a",
  ACCEPT_WITH_SUPPORT: "#7c3aed",
  HOLD: "#d97706",
  REJECT: "#dc2626",
};

export default function ChairComparisonSlideout({ application, onClose, onDecisionMade }: Props) {
  const [pending, startTransition] = useTransition();
  const [rationale, setRationale] = useState("");
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [staleState, setStaleState] = useState(false);

  if (!application) return null;

  const displayName =
    application.preferredFirstName ?? application.legalName ?? application.applicant.name ?? "Applicant";

  const reviewerNote = application.applicationReviews[0] ?? null;
  const hasReviewerNote = !!reviewerNote?.summary || !!reviewerNote?.notes;
  const hasInterviewReview = application.interviewReviews.length > 0;
  const hasBothMaterials = Boolean(application.materialsReadyAt);
  const hasSubjects = !!application.subjectsOfInterest?.trim();

  function handleDecide(action: ChairDecisionAction) {
    setError(null);
    setStaleState(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", application!.id);
      fd.set("action", action);
      if (rationale) fd.set("rationale", rationale);
      if (comparisonNotes) fd.set("comparisonNotes", comparisonNotes);
      const result = await chairDecide(fd);
      if (result.success) {
        onDecisionMade();
      } else {
        const msg = result.error ?? "An error occurred.";
        if (msg.includes("status changed") || msg === "STATUS_CHANGED") {
          setStaleState(true);
        } else {
          setError(msg);
        }
      }
    });
  }

  const daysInQueue = application.chairQueuedAt
    ? Math.floor((Date.now() - new Date(application.chairQueuedAt).getTime()) / 86400000)
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="chair-decision-backdrop"
        onClick={onClose}
      />

      {/* Slideout */}
      <div
        className="slideout-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Chair decision: ${displayName}`}
        data-chair-decision="true"
      >
        {/* Header */}
        <div
          className="chair-decision-header"
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{displayName}</h2>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {application.applicant.chapter && (
                <span className="pill pill-purple" style={{ fontSize: 12 }}>
                  {application.applicant.chapter.name}
                </span>
              )}
              {daysInQueue !== null && (
                <span className={`pill ${daysInQueue > 7 ? "pill-attention" : "pill-info"}`} style={{ fontSize: 12 }}>
                  {daysInQueue}d in queue
                </span>
              )}
              <span className="pill pill-chair-review" style={{ fontSize: 12 }}>Chair Review</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chair decision panel"
            className="chair-decision-close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="chair-decision-body">
          {/* Decision readiness */}
          <DecisionReadinessChecklist
            hasReviewerNote={hasReviewerNote}
            hasInterviewReview={hasInterviewReview}
            hasBothMaterials={hasBothMaterials}
            hasSubjects={hasSubjects}
          />

          {/* Reviewer note */}
          {reviewerNote && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>
                Reviewer Note {application.reviewer && `— ${application.reviewer.name}`}
              </p>
              <blockquote
                style={{
                  margin: 0,
                  padding: "12px 16px",
                  borderLeft: "3px solid #6b21c8",
                  background: "#faf5ff",
                  borderRadius: "0 6px 6px 0",
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "#374151",
                }}
              >
                {reviewerNote.summary ?? reviewerNote.notes ?? "—"}
              </blockquote>
              {reviewerNote.nextStep && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  Reviewer recommendation: <strong>{reviewerNote.nextStep.replace(/_/g, " ")}</strong>
                </p>
              )}
            </div>
          )}

          {/* Interview reviews */}
          {application.interviewReviews.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700 }}>Interview Reviews</p>
              {application.interviewReviews.map((review) => (
                <div
                  key={review.id}
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    marginBottom: 10,
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{review.reviewer.name ?? "Interviewer"}</strong>
                    {review.recommendation && (
                      <span
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: "#f3f4f6",
                          color: REC_COLOR[review.recommendation] ?? "#374151",
                          fontWeight: 700,
                          border: `1px solid ${REC_COLOR[review.recommendation] ?? "#e5e7eb"}`,
                        }}
                      >
                        {review.recommendation.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  {/* Category dots */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                    {review.categories.map((cat) => {
                      const colors: Record<string, string> = {
                        BEHIND_SCHEDULE: "#dc2626",
                        GETTING_STARTED: "#d97706",
                        ON_TRACK: "#16a34a",
                        ABOVE_AND_BEYOND: "#7c3aed",
                      };
                      return (
                        <span
                          key={cat.category}
                          title={`${cat.category.replace(/_/g, " ")}: ${cat.rating ?? "—"}`}
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: cat.rating ? (colors[cat.rating] ?? "#9ca3af") : "#e5e7eb",
                          }}
                        />
                      );
                    })}
                  </div>
                  {review.summary && (
                    <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                      {review.summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Materials preview */}
          {(
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>Materials</p>
              {["FIRST_CLASS_PLAN"].map((kind) => {
                const doc = application.documents.find((d) => d.kind === kind);
                return (
                  <div
                    key={kind}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: doc ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${doc ? "#bbf7d0" : "#fecaca"}`,
                      borderRadius: 6,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>
                      One-Class Plan & Structure Notes
                    </span>
                    {doc ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button outline"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                      >
                        View
                      </a>
                    ) : (
                      <span className="pill pill-attention" style={{ fontSize: 12 }}>Missing</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Rationale */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Decision Rationale
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain your reasoning (optional but recommended)…"
              rows={4}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Comparison notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              Comparison Notes (internal only)
            </label>
            <textarea
              value={comparisonNotes}
              onChange={(e) => setComparisonNotes(e.target.value)}
              placeholder="Notes for comparing with other applicants…"
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 13,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>

          {staleState && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                padding: "10px 14px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                color: "#92400e",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden>⚠️</span>
              This application was updated since you opened it. Close and reopen to see the latest state before deciding.
            </div>
          )}

          {error && !staleState && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="chair-decision-actions"
        >
          {ACTIONS.map((a) => (
            <button
              key={a.value}
              type="button"
              className={a.cls}
              disabled={pending}
              aria-label={`${a.label} application for ${displayName}`}
              onClick={() => handleDecide(a.value)}
              style={{
                fontSize: 13,
                flex: a.value === "APPROVE" || a.value === "REJECT" ? "1 1 auto" : undefined,
                background:
                  a.value === "APPROVE" ? "#16a34a" :
                  a.value === "REJECT" ? "#dc2626" : undefined,
                borderColor:
                  a.value === "APPROVE" ? "#16a34a" :
                  a.value === "REJECT" ? "#dc2626" : undefined,
              }}
            >
              {pending ? "…" : a.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
