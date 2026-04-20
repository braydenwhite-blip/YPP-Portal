"use client";

import { useState } from "react";
import ReviewerAssignPicker from "./ReviewerAssignPicker";
import InterviewerAssignPicker from "./InterviewerAssignPicker";
import ApplicantDocumentsPanel from "./ApplicantDocumentsPanel";
import ApplicantTimelineFeed from "./ApplicantTimelineFeed";
import type { ApplicantDocumentKind } from "@prisma/client";

interface InterviewerAssignment {
  id: string;
  interviewerId: string;
  role: "LEAD" | "SECOND";
  interviewer: { id: string; name: string | null; email: string };
}

interface ReviewerCandidate {
  id: string;
  name: string | null;
  email: string;
  chapterId: string | null;
  chapterMatch: boolean;
  reviewerActiveLoad: number;
  reviewerLastAssignedAt: Date | string | null;
}

interface InterviewerCandidate {
  id: string;
  name: string | null;
  email: string;
  chapterId: string | null;
  chapterMatch: boolean;
  interviewerActiveLoad: number;
  interviewerLastAssignedAt: Date | string | null;
}

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
    status: string;
    reviewerId: string | null;
    materialsReadyAt: Date | null;
    reviewer: { id: string; name: string | null } | null;
    interviewerAssignments: InterviewerAssignment[];
    documents: Array<{
      id: string;
      kind: ApplicantDocumentKind;
      fileUrl: string;
      originalName: string | null;
      uploadedAt: Date;
      supersededAt: Date | null;
    }>;
    timeline: SidebarTimelineEvent[];
  };
  canAssignReviewer: boolean;
  canAssignInterviewers: boolean;
  currentUserId: string;
  reviewerCandidates: ReviewerCandidate[];
  interviewerCandidatesLead: InterviewerCandidate[];
  interviewerCandidatesSecond: InterviewerCandidate[];
}

export default function ApplicantCockpitSidebar({
  application,
  canAssignReviewer,
  canAssignInterviewers,
  reviewerCandidates,
  interviewerCandidatesLead,
  interviewerCandidatesSecond,
}: Props) {
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const previewEvents = application.timeline.slice(0, 5);
  const hasLeadInterviewer = application.interviewerAssignments.some(
    (assignment) => assignment.role === "LEAD"
  );

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
      {/* Reviewer */}
      <section id="sidebar-reviewer" className="cockpit-sidebar-card">
        <h3>Assigned Reviewer</h3>
        {application.reviewer ? (
          <div className="cockpit-person-row">
            <div className="cockpit-person-avatar">
              {(application.reviewer.name ?? "?")[0]?.toUpperCase()}
            </div>
            <span>{application.reviewer.name ?? "Unknown"}</span>
          </div>
        ) : (
          <p className="cockpit-muted">
            No reviewer assigned
          </p>
        )}
        {canAssignReviewer && (
          <ReviewerAssignPicker
            applicationId={application.id}
            currentReviewerId={application.reviewerId}
            candidates={reviewerCandidates}
          />
        )}
      </section>

      {/* Interviewers */}
      <section id="sidebar-interviewers" className="cockpit-sidebar-card">
        <h3>Interviewers</h3>
        {(["LEAD", "SECOND"] as const).map((role) => {
          const assigned = application.interviewerAssignments.find((a) => a.role === role);
          return (
            <div key={role} className="cockpit-assignment-row">
              <p className="cockpit-assignment-label">
                {role}
              </p>
              {assigned ? (
                <div className="cockpit-person-row cockpit-person-row-small">
                  <div className={`cockpit-person-avatar${role === "SECOND" ? " is-secondary" : ""}`}>
                    {(assigned.interviewer.name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <span>{assigned.interviewer.name ?? assigned.interviewer.email}</span>
                </div>
              ) : (
                <p className="cockpit-muted cockpit-muted-small">Not assigned</p>
              )}
              {canAssignInterviewers && (
                <div className="cockpit-assignment-control">
                  <InterviewerAssignPicker
                    applicationId={application.id}
                    role={role}
                    currentAssignment={assigned ?? null}
                    candidates={role === "LEAD" ? interviewerCandidatesLead : interviewerCandidatesSecond}
                    disabled={role === "SECOND" && !hasLeadInterviewer}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

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
