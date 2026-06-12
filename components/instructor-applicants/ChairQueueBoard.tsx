"use client";

import Link from "next/link";
import { useState } from "react";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";

interface InterviewReview {
  id: string;
  reviewerId: string;
  recommendation: string | null;
  overallRating: string | null;
  summary?: string | null;
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
  motivation: string | null;
  teachingExperience: string | null;
  availability: string | null;
  subjectsOfInterest: string | null;
  courseIdea: string | null;
  textbook: string | null;
  courseOutline: string | null;
  firstClassPlan: string | null;
  materialsReadyAt: Date | string | null;
  chairQueuedAt: Date | string | null;
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string;
    chapterId: string | null;
    chapter: { id: string; name: string } | null;
  };
  reviewer: { id: string; name: string | null } | null;
  applicationReviews: Array<{
    summary: string | null;
    nextStep: string | null;
    notes: string | null;
    overallRating: string | null;
    categories: Array<{ category: string; rating: string | null; notes: string | null }>;
    editedAt: Date | string | null;
    editedBy: { name: string | null } | null;
  }>;
  interviewReviews: InterviewReview[];
  interviewerAssignments: Array<{ id: string; role: string; interviewer: { id: string; name: string | null } }>;
  documents: Document[];
}

interface Props {
  applications: ApplicationRow[];
}

const REC_DOT_CLASSES: Record<string, string> = {
  ACCEPT: "bg-emerald-500",
  ACCEPT_WITH_SUPPORT: "bg-teal-500",
  HOLD: "bg-amber-500",
  REJECT: "bg-rose-500",
};

const REC_LABELS: Record<string, string> = {
  ACCEPT: "Accept",
  ACCEPT_WITH_SUPPORT: "Accept with Support",
  HOLD: "Hold",
  REJECT: "Reject",
};

export default function ChairQueueBoard({ applications }: Props) {
  const [showAll, setShowAll] = useState(true);

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

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-100 ${
      active
        ? "border-brand-600 bg-brand-50 text-brand-700"
        : "border-line bg-surface text-ink-muted hover:bg-surface-soft hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Filter by chapter"
        className="flex flex-wrap items-center gap-1.5"
      >
        <button
          role="tab"
          type="button"
          aria-selected={showAll}
          onClick={() => { setActiveChapterId(null); setShowAll(true); }}
          className={tabClass(showAll)}
        >
          <span>YPP-wide</span>
          <strong className="font-bold">{applications.length}</strong>
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
              className={tabClass(active)}
            >
              <span>{chapName}</span>
              <strong className="font-bold">{count}</strong>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-line px-5 py-8 text-center">
          <p className="m-0 text-[13.5px] text-ink-muted">No applications in the chair queue.</p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {displayed.map((app) => {
            const days = daysInQueue(app);
            const displayName = formatApplicantDisplayName(app);
            const reviewerRec = app.applicationReviews[0];
            const submittedRecs = new Set(app.interviewReviews.map((review) => review.reviewerId));
            const missingRecommendations = app.interviewerAssignments.filter(
              (assignment) => !submittedRecs.has(assignment.interviewer.id)
            ).length;

            return (
              <li key={app.id}>
                <Link
                  aria-label={`Open chair decision for ${displayName}`}
                  href={`/admin/instructor-applicants/${app.id}/review`}
                  className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line-soft bg-surface px-4 py-3 no-underline shadow-card transition-colors duration-100 hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
                >
                  <div className="min-w-44 flex-1">
                    <p className="m-0 text-[13.5px] font-semibold text-ink">{displayName}</p>
                    {app.applicant.chapter && (
                      <span className="text-[12px] text-ink-muted">
                        {app.applicant.chapter.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5" aria-label="Decision evidence">
                    {days !== null && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          days > 7
                            ? "bg-amber-50 text-amber-800"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {days}d queued
                      </span>
                    )}

                    {reviewerRec?.nextStep && (
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                        {reviewerRec.nextStep.replace(/_/g, " ")}
                      </span>
                    )}

                    {missingRecommendations > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {missingRecommendations} Rec Missing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1" aria-label="Interviewer recommendations">
                    {app.interviewReviews.map((ir) => (
                      <span
                        key={ir.reviewerId}
                        title={`${ir.reviewer.name ?? "Interviewer"}: ${ir.recommendation ? REC_LABELS[ir.recommendation] ?? ir.recommendation : "No recommendation"}`}
                        className={`size-2.5 rounded-full ${ir.recommendation ? REC_DOT_CLASSES[ir.recommendation] ?? "bg-gray-300" : "bg-gray-300"}`}
                      >
                        <span className="sr-only">
                          {ir.reviewer.name ?? "Interviewer"}: {ir.recommendation ? REC_LABELS[ir.recommendation] ?? ir.recommendation : "No recommendation"}
                        </span>
                      </span>
                    ))}
                  </div>

                  <span className="text-[16px] text-ink-muted" aria-hidden="true">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
