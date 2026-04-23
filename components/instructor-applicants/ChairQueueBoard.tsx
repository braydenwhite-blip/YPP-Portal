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
  onRefresh: () => void;
}

const REC_CLASSES: Record<string, string> = {
  ACCEPT: "is-accept",
  ACCEPT_WITH_SUPPORT: "is-support",
  HOLD: "is-hold",
  REJECT: "is-reject",
};

const REC_LABELS: Record<string, string> = {
  ACCEPT: "Accept",
  ACCEPT_WITH_SUPPORT: "Accept with Support",
  HOLD: "Hold",
  REJECT: "Reject",
};

export default function ChairQueueBoard({ applications, onRefresh }: Props) {
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
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

  return (
    <div className="chair-queue-board">
      <div
        role="tablist"
        aria-label="Filter by chapter"
        className="chair-queue-tabs"
      >
        <button
          role="tab"
          type="button"
          aria-selected={showAll}
          onClick={() => { setActiveChapterId(null); setShowAll(true); }}
          className="chair-queue-tab"
          data-active={showAll}
        >
          <span>YPP-wide</span>
          <strong>{applications.length}</strong>
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
              className="chair-queue-tab"
              data-active={active}
            >
              <span>{chapName}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <div className="chair-queue-empty">
          <p>No applications in the chair queue.</p>
        </div>
      ) : (
        <div className="chair-queue-list">
          {displayed.map((app) => {
            const days = daysInQueue(app);
            const displayName =
              app.preferredFirstName ?? app.legalName ?? app.applicant.name ?? "Applicant";
            const reviewerRec = app.applicationReviews[0];
            const submittedRecs = new Set(app.interviewReviews.map((review) => review.reviewerId));
            const missingRecommendations = app.interviewerAssignments.filter(
              (assignment) => !submittedRecs.has(assignment.interviewer.id)
            ).length;

            return (
              <button
                key={app.id}
                type="button"
                aria-label={`Open chair decision for ${displayName}`}
                onClick={() => setSelectedApp(app)}
                className="chair-queue-row"
              >
                <div className="chair-queue-applicant">
                  <p>{displayName}</p>
                  {app.applicant.chapter && (
                    <span>
                      {app.applicant.chapter.name}
                    </span>
                  )}
                </div>

                <div className="chair-queue-evidence" aria-label="Decision evidence">
                  {days !== null && (
                    <span className={`chair-queue-chip ${days > 7 ? "is-warn" : "is-info"}`}>
                      {days}d queued
                    </span>
                  )}

                  {reviewerRec?.nextStep && (
                    <span className="chair-queue-chip is-reviewer">
                      {reviewerRec.nextStep.replace(/_/g, " ")}
                    </span>
                  )}

                  {missingRecommendations > 0 && (
                    <span className="chair-queue-chip is-warn">
                      {missingRecommendations} Rec Missing
                    </span>
                  )}
                </div>

                <div className="chair-queue-recs" aria-label="Interviewer recommendations">
                  {app.interviewReviews.map((ir) => (
                    <span
                      key={ir.reviewerId}
                      title={`${ir.reviewer.name ?? "Interviewer"}: ${ir.recommendation ? REC_LABELS[ir.recommendation] ?? ir.recommendation : "No recommendation"}`}
                      className={`chair-rec-dot ${ir.recommendation ? REC_CLASSES[ir.recommendation] ?? "" : ""}`}
                    >
                      <span className="sr-only">
                        {ir.reviewer.name ?? "Interviewer"}: {ir.recommendation ? REC_LABELS[ir.recommendation] ?? ir.recommendation : "No recommendation"}
                      </span>
                    </span>
                  ))}
                </div>

                <span className="chair-queue-arrow" aria-hidden="true">›</span>
              </button>
            );
          })}
        </div>
      )}

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
