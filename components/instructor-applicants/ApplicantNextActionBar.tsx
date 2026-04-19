"use client";

import { useState, useTransition } from "react";
import { sendToChair, assignReviewer } from "@/lib/instructor-application-actions";
import type { InstructorApplicationStatus } from "@prisma/client";

interface Props {
  application: {
    id: string;
    status: InstructorApplicationStatus;
    reviewerId: string | null;
    materialsReadyAt: Date | null;
    interviewerAssignments: Array<{ role: "LEAD" | "SECOND"; removedAt: Date | null }>;
  };
  canAssignReviewer: boolean;
  canAssignInterviewers: boolean;
  isAssignedReviewer: boolean;
  isAssignedInterviewer: boolean;
  canActAsChair: boolean;
  isAdmin: boolean;
  hidden?: boolean;
}

export default function ApplicantNextActionBar({
  application,
  canAssignReviewer,
  canAssignInterviewers,
  isAssignedReviewer,
  isAssignedInterviewer,
  canActAsChair,
  isAdmin,
  hidden = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (hidden) return null;

  const { status } = application;
  const hasLead = application.interviewerAssignments.some((a) => a.role === "LEAD" && !a.removedAt);

  // Derive the single most important next action
  let action: { label: string; description: string; handler?: () => void; href?: string } | null = null;

  if (!application.reviewerId && canAssignReviewer) {
    action = {
      label: "Assign Reviewer",
      description: "A reviewer must be assigned before this application can advance.",
      href: "#sidebar-reviewer",
    };
  } else if (
    status === "UNDER_REVIEW" &&
    !hasLead &&
    (canAssignInterviewers || isAssignedReviewer)
  ) {
    action = {
      label: "Assign Lead Interviewer",
      description: "After review is submitted with MOVE_TO_INTERVIEW, assign a lead interviewer.",
      href: "#sidebar-interviewers",
    };
  } else if (status === "UNDER_REVIEW" && isAssignedReviewer) {
    action = {
      label: "Submit Review",
      description: "Complete and submit the applicant review rubric.",
      href: "#section-review",
    };
  } else if (status === "INTERVIEW_SCHEDULED" && !application.materialsReadyAt && isAssignedInterviewer) {
    action = {
      label: "Upload Materials",
      description: "Course Outline and First Class Plan are still missing.",
      href: "#sidebar-documents",
    };
  } else if (status === "INTERVIEW_SCHEDULED" && isAssignedInterviewer) {
    action = {
      label: "Post Interview Slots",
      description: "Post available interview time slots for the applicant to confirm.",
      href: "#section-scheduling",
    };
  } else if (status === "INTERVIEW_COMPLETED" && canActAsChair) {
    action = {
      label: "Send to Chair",
      description: "All interviews are complete. Send this application to the chair queue.",
      handler: () => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("applicationId", application.id);
          const result = await sendToChair(fd);
          setMessage({ text: result.error ?? "Sent to chair queue.", ok: result.success });
        });
      },
    };
  } else if (status === "CHAIR_REVIEW" && canActAsChair) {
    action = {
      label: "Make Decision",
      description: "Review this application in the Chair Queue and record your decision.",
      href: "/admin/instructor-applicants/chair-queue",
    };
  }

  if (!action) return null;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        background: "#fff",
        borderTop: "1px solid #e5e7eb",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        zIndex: 50,
        boxShadow: "0 -2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{action.label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--muted)" }}>{action.description}</p>
        {message && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: message.ok ? "#16a34a" : "#dc2626" }}>
            {message.text}
          </p>
        )}
      </div>
      {action.handler ? (
        <button
          type="button"
          className="button"
          onClick={action.handler}
          disabled={pending}
          style={{ minWidth: 140, flexShrink: 0 }}
        >
          {pending ? "Sending…" : action.label}
        </button>
      ) : action.href ? (
        <a href={action.href} className="button" style={{ minWidth: 140, flexShrink: 0, textAlign: "center" }}>
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
