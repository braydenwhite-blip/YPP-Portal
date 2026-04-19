"use client";

import { useState } from "react";
import ReviewerAssignPicker from "./ReviewerAssignPicker";
import InterviewerAssignPicker from "./InterviewerAssignPicker";
import ApplicantDocumentsPanel from "./ApplicantDocumentsPanel";
import ApplicantTimelineFeed from "./ApplicantTimelineFeed";
import type { InstructorApplicationTimelineEvent } from "@prisma/client";

interface InterviewerAssignment {
  id: string;
  interviewerId: string;
  role: "LEAD" | "SECOND";
  interviewer: { id: string; name: string | null; email: string };
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
      kind: string;
      fileUrl: string;
      originalName: string | null;
      uploadedAt: Date;
      supersededAt: Date | null;
    }>;
    timeline: InstructorApplicationTimelineEvent[];
  };
  canAssignReviewer: boolean;
  canAssignInterviewers: boolean;
  currentUserId: string;
}

export default function ApplicantCockpitSidebar({
  application,
  canAssignReviewer,
  canAssignInterviewers,
  currentUserId,
}: Props) {
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const previewEvents = application.timeline.slice(0, 5);

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Reviewer */}
      <section className="card" style={{ padding: "16px 20px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Assigned Reviewer</h3>
        {application.reviewer ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#6b21c8",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {(application.reviewer.name ?? "?")[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: 14 }}>{application.reviewer.name ?? "Unknown"}</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
            No reviewer assigned
          </p>
        )}
        {canAssignReviewer && (
          <ReviewerAssignPicker
            applicationId={application.id}
            currentReviewerId={application.reviewerId}
          />
        )}
      </section>

      {/* Interviewers */}
      <section className="card" style={{ padding: "16px 20px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Interviewers</h3>
        {(["LEAD", "SECOND"] as const).map((role) => {
          const assigned = application.interviewerAssignments.find((a) => a.role === role);
          return (
            <div key={role} style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                {role}
              </p>
              {assigned ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: role === "LEAD" ? "#6b21c8" : "#a855f7",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {(assigned.interviewer.name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13 }}>{assigned.interviewer.name ?? assigned.interviewer.email}</span>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Not assigned</p>
              )}
              {canAssignInterviewers && (
                <div style={{ marginTop: 6 }}>
                  <InterviewerAssignPicker
                    applicationId={application.id}
                    role={role}
                    currentAssignment={assigned ?? null}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Documents */}
      <ApplicantDocumentsPanel
        applicationId={application.id}
        documents={application.documents}
        materialsReadyAt={application.materialsReadyAt}
        currentUserId={currentUserId}
      />

      {/* Timeline preview */}
      <section className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Recent Activity</h3>
          {application.timeline.length > 5 && (
            <button
              type="button"
              className="button outline"
              style={{ fontSize: 12, padding: "3px 10px" }}
              onClick={() => setShowAllTimeline(!showAllTimeline)}
            >
              {showAllTimeline ? "Show less" : `See all (${application.timeline.length})`}
            </button>
          )}
        </div>
        <ApplicantTimelineFeed events={showAllTimeline ? application.timeline : previewEvents} compact />
      </section>
    </aside>
  );
}
