"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chairDecide } from "@/lib/instructor-application-actions";
import DecisionReadinessChecklist from "./DecisionReadinessChecklist";
import {
  INITIAL_REVIEW_RATING_OPTIONS,
  INSTRUCTOR_INITIAL_REVIEW_SIGNALS,
} from "@/lib/instructor-review-config";
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
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  textbook: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
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
  applicationReviews: Array<{
    summary: string | null;
    nextStep: string | null;
    notes: string | null;
    categories: Category[];
    editedAt: Date | string | null;
    editedBy: { name: string | null } | null;
  }>;
  interviewReviews: InterviewReview[];
  documents: Array<{ kind: string; fileUrl: string; originalName: string | null }>;
}

interface Props {
  application: Application;
  backHref: string;
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

function RoughPlanField({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {value?.trim() || "Not provided"}
      </p>
    </div>
  );
}

export default function ChairDecisionWorkspace({ application, backHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rationale, setRationale] = useState("");
  const [comparisonNotes, setComparisonNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [staleState, setStaleState] = useState(false);

  const displayName =
    application.preferredFirstName ?? application.legalName ?? application.applicant.name ?? "Applicant";

  const reviewerNote = application.applicationReviews[0] ?? null;
  const hasReviewerNote = !!reviewerNote?.summary || !!reviewerNote?.notes;
  const hasInterviewReview = application.interviewReviews.length > 0;
  const hasOptionalDocuments = Boolean(application.materialsReadyAt);
  const hasSubjects = !!application.subjectsOfInterest?.trim();
  const roughClassIdea = application.courseIdea ?? application.textbook;
  const lightSignals = (reviewerNote?.categories ?? []).filter((category) =>
    INSTRUCTOR_INITIAL_REVIEW_SIGNALS.some((signal) => signal.key === category.category)
  );
  const daysInQueue = application.chairQueuedAt
    ? Math.floor((Date.now() - new Date(application.chairQueuedAt).getTime()) / 86400000)
    : null;

  function handleDecide(action: ChairDecisionAction) {
    setError(null);
    setStaleState(false);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", application.id);
      fd.set("action", action);
      if (rationale) fd.set("rationale", rationale);
      if (comparisonNotes) fd.set("comparisonNotes", comparisonNotes);
      const result = await chairDecide(fd);
      if (result.success) {
        router.push(backHref);
        router.refresh();
        return;
      }

      const msg = result.error ?? "An error occurred.";
      if (msg.includes("status changed") || msg === "STATUS_CHANGED") {
        setStaleState(true);
      } else {
        setError(msg);
      }
    });
  }

  return (
    <div className="chair-review-layout">
      <main className="chair-review-main">
        <section className="chair-review-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Applicant Snapshot</p>
              <h2>{displayName}</h2>
            </div>
            <div className="chair-review-chip-row">
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

          <div className="chair-review-summary-grid">
            <div className="slideout-field">
              <div className="slideout-field-label">Applicant email</div>
              <div className="slideout-field-value">{application.applicant.email}</div>
            </div>
            <div className="slideout-field">
              <div className="slideout-field-label">Lead reviewer</div>
              <div className="slideout-field-value">{application.reviewer?.name ?? "Unassigned"}</div>
            </div>
            <div className="slideout-field">
              <div className="slideout-field-label">Interview reviews</div>
              <div className="slideout-field-value">{application.interviewReviews.length}</div>
            </div>
            <div className="slideout-field">
              <div className="slideout-field-label">Optional docs</div>
              <div className="slideout-field-value">{application.documents.length}</div>
            </div>
          </div>
        </section>

        <DecisionReadinessChecklist
          hasReviewerNote={hasReviewerNote}
          hasInterviewReview={hasInterviewReview}
          hasOptionalDocuments={hasOptionalDocuments}
          hasSubjects={hasSubjects}
        />

        <section className="chair-review-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Application Answers</p>
              <h2>Applicant Materials</h2>
            </div>
          </div>
          <RoughPlanField label="Motivation" value={application.motivation} />
          <RoughPlanField label="Teaching experience" value={application.teachingExperience} />
          <RoughPlanField label="Interview availability" value={application.availability} />
          <RoughPlanField label="Subjects of interest" value={application.subjectsOfInterest} />
        </section>

        <section className="chair-review-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Course Preview</p>
              <h2>Rough Course Plan</h2>
            </div>
          </div>
          <RoughPlanField label="Class idea" value={roughClassIdea} />
          <RoughPlanField label="Rough outline" value={application.courseOutline} />
          <RoughPlanField label="First-session sketch" value={application.firstClassPlan} />
        </section>

        {reviewerNote && (
          <section className="chair-review-card">
            <div className="chair-review-card-header">
              <div>
                <p className="chair-review-card-kicker">Lead Review</p>
                <h2>Reviewer Note</h2>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                {application.reviewer?.name ?? "Lead reviewer"}
              </p>
              {reviewerNote.editedAt && (
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: "#fef3c7",
                    color: "#92400e",
                    border: "1px solid #fde68a",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Edited{reviewerNote.editedBy?.name ? ` by ${reviewerNote.editedBy.name}` : ""} &middot;{" "}
                  {new Date(reviewerNote.editedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>

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
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                Reviewer recommendation: <strong>{reviewerNote.nextStep.replace(/_/g, " ")}</strong>
              </p>
            )}

            {lightSignals.length > 0 && (
              <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
                {lightSignals.map((signal) => {
                  const meta = INSTRUCTOR_INITIAL_REVIEW_SIGNALS.find(
                    (entry) => entry.key === signal.category
                  );
                  const rating = INITIAL_REVIEW_RATING_OPTIONS.find(
                    (entry) => entry.value === signal.rating
                  );
                  return (
                    <div
                      key={signal.category}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {meta?.label ?? signal.category.replace(/_/g, " ")}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: rating?.color ?? "#374151",
                          background: rating?.bg ?? "#f3f4f6",
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        {rating?.shortLabel ?? signal.rating ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="chair-review-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Interview Signal</p>
              <h2>Interview Reviews</h2>
            </div>
          </div>
          {application.interviewReviews.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {application.interviewReviews.map((review) => (
                <div
                  key={review.id}
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
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
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              No interview reviews were submitted for this round.
            </p>
          )}
        </section>

        <section className="chair-review-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Supporting Material</p>
              <h2>Optional Documents</h2>
            </div>
          </div>
          {["FIRST_CLASS_PLAN"].map((kind) => {
            const doc = application.documents.find((d) => d.kind === kind);
            return (
              <div
                key={kind}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  background: doc ? "#f0fdf4" : "#f9fafb",
                  border: `1px solid ${doc ? "#bbf7d0" : "#e5e7eb"}`,
                  borderRadius: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  One-Class Plan & Structure Notes
                </span>
                {doc ? (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button outline"
                    style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap" }}
                  >
                    View
                  </a>
                ) : (
                  <span className="pill" style={{ fontSize: 12 }}>Not uploaded</span>
                )}
              </div>
            );
          })}
        </section>
      </main>

      <aside className="chair-review-sidebar">
        <section className="chair-review-card chair-review-sidebar-card">
          <div className="chair-review-card-header">
            <div>
              <p className="chair-review-card-kicker">Chair Action</p>
              <h2>Record Decision</h2>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Decision Rationale
          </label>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Explain your reasoning (optional but recommended)…"
            rows={5}
            className="input"
            style={{ marginBottom: 14, resize: "vertical" }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Comparison Notes (internal only)
          </label>
          <textarea
            value={comparisonNotes}
            onChange={(e) => setComparisonNotes(e.target.value)}
            placeholder="Notes for comparing with other applicants…"
            rows={4}
            className="input"
            style={{ marginBottom: 14, resize: "vertical" }}
          />

          {staleState && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                padding: "10px 14px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 6,
                marginBottom: 14,
                fontSize: 13,
                color: "#92400e",
              }}
            >
              This application changed while you were reviewing it. Return to the queue and reopen it before deciding.
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
                marginBottom: 14,
                fontSize: 13,
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          <div className="chair-review-sidebar-actions">
            {ACTIONS.map((action) => (
              <button
                key={action.value}
                type="button"
                className={action.cls}
                disabled={pending}
                aria-label={`${action.label} application for ${displayName}`}
                onClick={() => handleDecide(action.value)}
                style={{
                  fontSize: 13,
                  width: "100%",
                  justifyContent: "center",
                  background:
                    action.value === "APPROVE" ? "#16a34a" :
                    action.value === "REJECT" ? "#dc2626" : undefined,
                  borderColor:
                    action.value === "APPROVE" ? "#16a34a" :
                    action.value === "REJECT" ? "#dc2626" : undefined,
                }}
              >
                {pending ? "Working…" : action.label}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
