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
  /** Same-chapter Chapter Presidents can route an interview-completed
   *  application to chair review themselves. */
  canSendToChair?: boolean;
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
  canSendToChair = false,
  isAdmin,
  hidden = false,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (hidden) return null;

  const { status } = application;
  const hasLead = application.interviewerAssignments.some((a) => a.role === "LEAD" && !a.removedAt);
  const canRouteToChair = canActAsChair || canSendToChair;

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
  } else if (status === "INTERVIEW_COMPLETED" && canRouteToChair) {
    action = {
      label: "Send to Chair",
      description: canActAsChair
        ? "All interviews are complete. Send this application to the chair queue."
        : "Interviews are complete — route this application to the hiring chair to make the final decision.",
      handler: () => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("applicationId", application.id);
          const result = await sendToChair(fd);
          setMessage({ text: result.error ?? "Sent to chair queue.", ok: result.success });
        });
      },
    };
  } else if (status === "INTERVIEW_COMPLETED") {
    // Show a "waiting on..." nudge so reviewers/CPs know why nothing has advanced.
    action = {
      label: "Waiting on chair review",
      description:
        "All interviewer reviews aren't in yet, or the application is queued for the hiring chair. Nothing more to do from this view.",
    };
  } else if (status === "CHAIR_REVIEW" && canActAsChair) {
    action = {
      label: "Make Decision",
      description: "Open the full chair review workspace and record your decision.",
      href: `/admin/instructor-applicants/chair-queue/${application.id}`,
    };
  } else if (status === "CHAIR_REVIEW") {
    action = {
      label: "Awaiting chair decision",
      description: "This application is in the hiring chair's queue. You'll be notified when a decision is recorded.",
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
      ) : (
        <span
          className="pill pill-pending applicant-next-action-button"
          aria-live="polite"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          Waiting
        </span>
      )}
    </div>
  );
}
