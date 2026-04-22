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
    interviewScheduledAt: Date | null;
    leadReviewNextStep?: string | null;
    interviewerAssignments: Array<{ role: "LEAD" | "SECOND"; removedAt: Date | null }>;
  };
  canAssignReviewer: boolean;
  canAssignInterviewers: boolean;
  isAssignedReviewer: boolean;
  isAssignedInterviewer: boolean;
  isAssignedLeadInterviewer: boolean;
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
  isAssignedLeadInterviewer,
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
      href: "#section-review",
    };
  } else if (
    status === "UNDER_REVIEW" &&
    application.leadReviewNextStep === "MOVE_TO_INTERVIEW" &&
    !hasLead &&
    (canAssignInterviewers || isAssignedReviewer)
  ) {
    action = {
      label: "Assign Lead Interviewer",
      description: "A lead interviewer must be assigned before proposed times can be sent.",
      href: "#section-scheduling",
    };
  } else if (
    status === "UNDER_REVIEW" &&
    application.leadReviewNextStep === "MOVE_TO_INTERVIEW" &&
    (isAssignedLeadInterviewer || isAdmin)
  ) {
    action = {
      label: "Send Interview Times",
      description: "Send at least 3 proposed times to move this applicant into interview scheduling.",
      href: "#section-scheduling",
    };
  } else if (status === "UNDER_REVIEW" && isAssignedReviewer) {
    action = {
      label: "Submit Initial Review",
      description: "Complete the light paper screen and choose the next step.",
      href: "#section-review",
    };
  } else if (
    status === "INTERVIEW_SCHEDULED" &&
    !application.interviewScheduledAt &&
    (isAssignedLeadInterviewer || isAdmin)
  ) {
    action = {
      label: "Update Interview Times",
      description: "The applicant has not picked a time yet. Send a fresh set if needed.",
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
    <div className="applicant-next-action-bar">
      <div>
        <p className="applicant-next-action-title">{action.label}</p>
        <p className="applicant-next-action-description">{action.description}</p>
        {message && (
          <p className={message.ok ? "cockpit-form-success" : "cockpit-form-error"}>
            {message.text}
          </p>
        )}
      </div>
      {action.handler ? (
        <button
          type="button"
          className="button applicant-next-action-button"
          onClick={action.handler}
          disabled={pending}
        >
          {pending ? "Sending…" : action.label}
        </button>
      ) : action.href ? (
        <a href={action.href} className="button applicant-next-action-button">
          {action.label}
        </a>
      ) : null}
    </div>
  );
}
