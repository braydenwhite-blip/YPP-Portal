"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui-v2";
import { formatScheduleDateTime } from "@/lib/scheduling/shared";
import { completeInterviewStage } from "@/lib/instructor-application-actions";
import { ArchiveOneButton } from "./ArchiveActions";
import {
  formatApplicantDisplayName,
  isApplicantLastNameMissing,
} from "@/lib/applicant-display-name";

type DrawerApp = {
  id: string;
  status: string;
  materialsReadyAt: Date | string | null;
  interviewScheduledAt?: Date | string | null;
  updatedAt?: Date | string;
  overdue?: boolean;
  subjectsOfInterest: string | null;
  legalName?: string | null;
  preferredFirstName?: string | null;
  lastName?: string | null;
  applicationTrack?: string;
  workshopTitle?: string | null;
  workshopAgeRange?: string | null;
  workshopDurationMinutes?: number | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapter: { name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  interviewerAssignments: Array<{
    id: string;
    role: string;
    interviewer: { id: string; name: string | null };
  }>;
  applicationReviews?: Array<{
    summary: string | null;
    nextStep: string | null;
    overallRating: string | null;
  }>;
};

interface ApplicantQuickDrawerProps {
  app: DrawerApp;
  onClose: () => void;
  isAdmin?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "New",
  UNDER_REVIEW: "Under Review",
  INFO_REQUESTED: "Info Requested",
  PRE_APPROVED: "Pre-Approved",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  CHAIR_REVIEW: "Chair Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  WITHDRAWN: "Withdrawn",
};

export default function ApplicantQuickDrawer({
  app,
  onClose,
  isAdmin = false,
}: ApplicantQuickDrawerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const leadInterviewer = app.interviewerAssignments.find((a) => a.role === "LEAD");
  const secondInterviewer = app.interviewerAssignments.find((a) => a.role === "SECOND");
  const leadReview = app.applicationReviews?.[0];
  const displayName = formatApplicantDisplayName(app);
  const missingLastName = isApplicantLastNameMissing(app);

  // The interview has a confirmed time → the next concrete move is to mark it
  // complete, which advances the card into Post-Interview. This is the inline
  // mirror of the action bar on the full workspace, so reviewers don't have to
  // navigate away just to advance a candidate they already interviewed.
  const canMarkInterviewComplete =
    app.status === "INTERVIEW_SCHEDULED" && Boolean(app.interviewScheduledAt);

  // A short, status-aware "what happens next" line. Read-only guidance so the
  // board never leaves someone guessing why a card is sitting where it is.
  const nextStepHint: string | null = (() => {
    switch (app.status) {
      case "SUBMITTED":
        return app.reviewer
          ? "Assigned for review — the reviewer completes the paper screen next."
          : "Assign a reviewer to start the paper screen.";
      case "UNDER_REVIEW":
        return "Reviewer is screening. Next step is submitting the initial review.";
      case "INFO_REQUESTED":
        return "Waiting on the applicant to provide the requested information.";
      case "PRE_APPROVED":
        return "Pre-approved — send interview times to get on the calendar.";
      case "INTERVIEW_SCHEDULED":
        return app.interviewScheduledAt
          ? "Interview is on the calendar. After it happens, mark it complete to move to post-interview."
          : "Awaiting the applicant to pick a time from the proposed slots.";
      case "INTERVIEW_COMPLETED":
        return "Interview done — submit any interview reviews, then send to the hiring chair.";
      case "CHAIR_REVIEW":
        return "In the hiring chair's queue for the final decision.";
      default:
        return null;
    }
  })();

  function handleMarkComplete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("applicationId", app.id);
      const result = await completeInterviewStage(fd);
      setMessage({
        text: result.error ?? "Interview marked complete — moved to Post-Interview.",
        ok: result.success,
      });
      if (result.success) {
        router.refresh();
      }
    });
  }

  // An application can sit in INTERVIEW_SCHEDULED with no confirmed time yet
  // (interviewScheduledAt === null) while a time is still being arranged. Only
  // claim "Interview Scheduled" once a real time exists; otherwise the field
  // below ("Not scheduled") would contradict the header pill.
  const statusLabel =
    app.status === "INTERVIEW_SCHEDULED" && !app.interviewScheduledAt
      ? "Awaiting Time"
      : STATUS_LABELS[app.status] ?? app.status.replace(/_/g, " ");

  return (
    <>
      <div className="slideout-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="slideout-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Applicant detail: ${displayName}`}
      >
        {/* Header */}
        <div className="slideout-header">
          <div>
            <div className="text-[16px] font-bold text-ink">
              {displayName}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {app.applicant.chapter && (
                <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">{app.applicant.chapter.name}</span>
              )}
              <span
                className={`status-pill ${app.status.toLowerCase().replace(/_/g, "-")}`}
                aria-label={`Status: ${statusLabel}`}
              >
                {statusLabel}
              </span>
              {missingLastName && (
                <span className="pill pill-attention pill-small" title="This legacy application is missing an explicit last name.">
                  Missing last name
                </span>
              )}
              {app.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && (
                <span
                  className="pill pill-small"
                  title="Summer Workshop Instructor applicant"
                  style={{
                    background: "#f5f3ff",
                    color: "#6b21c8",
                    border: "1px solid #ddd6fe",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  Summer Workshop
                </span>
              )}
              {app.overdue && (
                <span className="pill pill-attention pill-small">Overdue</span>
              )}
            </div>
          </div>
          <button
            className="slideout-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="slideout-body">
              {/* Next step — status-aware guidance so nobody guesses why a
                  card is parked in a column. */}
              {nextStepHint && (
                <div className="mb-3 rounded-[10px] border border-warning-700/25 bg-warning-100/40 px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-warning-700">
                    Next step
                  </div>
                  <div className="mt-0.5 text-[13px] leading-snug text-ink">
                    {nextStepHint}
                  </div>
                  {canMarkInterviewComplete && (
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      disabled={pending}
                      className="mt-2 inline-flex cursor-pointer items-center justify-center rounded-[8px] bg-brand-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-card transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "Mark Interview Complete"}
                    </button>
                  )}
                  {message && (
                    <div
                      className={
                        message.ok
                          ? "mt-1.5 text-[12px] font-semibold text-success-600"
                          : "mt-1.5 text-[12px] font-semibold text-danger-700"
                      }
                    >
                      {message.text}
                    </div>
                  )}
                </div>
              )}

              {/* Key details */}
              <div className="slideout-section">
                <div className="slideout-section-title">Quick glance</div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Email</div>
                  <div className="slideout-field-value">
                    <a href={`mailto:${app.applicant.email}`}>{app.applicant.email}</a>
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Interview</div>
                  <div className="slideout-field-value">
                    {app.interviewScheduledAt ? formatScheduleDateTime(app.interviewScheduledAt) : "Not scheduled"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Materials</div>
                  <div className="slideout-field-value">
                    {app.materialsReadyAt ? "Ready" : "Missing"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Updated</div>
                  <div className="slideout-field-value">
                    {app.updatedAt ? new Date(app.updatedAt).toLocaleString() : "—"}
                  </div>
                </div>
              </div>

              {/* Workshop summary (Summer Workshop track) */}
              {app.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Workshop</div>
                  {app.workshopTitle ? (
                    <>
                      <div className="slideout-field-value">
                        <strong>{app.workshopTitle}</strong>
                      </div>
                      <div
                        className="slideout-field-value"
                        style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}
                      >
                        {[
                          app.workshopAgeRange,
                          app.workshopDurationMinutes
                            ? `${app.workshopDurationMinutes} min`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Details in full workspace"}
                      </div>
                    </>
                  ) : (
                    <div className="text-[13px] italic text-ink-muted">
                      No workshop outline submitted
                    </div>
                  )}
                </div>
              )}

              {/* Subjects */}
              {app.subjectsOfInterest && (
              <div className="slideout-section">
                <div className="slideout-section-title">Subjects of Interest</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {app.subjectsOfInterest
                      .split(/[\s,;]+/)
                      .filter(Boolean)
                      .map((s) => (
                        <span key={s} className="pill pill-purple pill-small">{s}</span>
                      ))}
                  </div>
                </div>
              )}

              {/* Reviewer */}
              <div className="slideout-section">
                <div className="slideout-section-title">Reviewer</div>
                {app.reviewer ? (
                  <div className="slideout-field-value">{app.reviewer.name ?? "Unknown"}</div>
                ) : (
                  <div className="text-[13px] italic text-ink-muted">Not assigned</div>
                )}
              </div>

              {/* Interviewers */}
              <div className="slideout-section">
                <div className="slideout-section-title">Interviewers</div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Lead</div>
                  <div className="slideout-field-value">
                    {leadInterviewer?.interviewer.name ?? "Not assigned"}
                  </div>
                </div>
                <div className="slideout-field">
                  <div className="slideout-field-label">Second</div>
                  <div className="slideout-field-value">
                    {secondInterviewer?.interviewer.name ?? "Not assigned"}
                  </div>
                </div>
              </div>

              {/* Lead review summary */}
              {leadReview?.summary && (
                <div className="slideout-section">
                  <div className="slideout-section-title">Reviewer note</div>
                  <div className="rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2 text-[13px] leading-relaxed text-ink">
                    {leadReview.summary}
                  </div>
                </div>
              )}

              {/* Open record / workspace CTAs */}
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink href={`/admin/instructor-applicants/${app.id}`} variant="primary" size="md">
                  Open Application 360
                </ButtonLink>
                <ButtonLink href={`/applications/instructor/${app.id}`} variant="secondary" size="md">
                  Full workspace
                </ButtonLink>
                {isAdmin && (
                  <ArchiveOneButton
                    applicationId={app.id}
                    kind="instructor"
                    applicantName={displayName}
                    onArchived={onClose}
                  />
                )}
              </div>
        </div>
      </div>
    </>
  );
}
