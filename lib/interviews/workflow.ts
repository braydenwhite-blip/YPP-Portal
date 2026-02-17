import type { InterviewStage, InterviewTask, InterviewTaskAudience } from "@/lib/interviews/types";

type HiringSlot = {
  id: string;
  status: string;
  scheduledAt: Date;
  confirmedAt?: Date | null;
  completedAt?: Date | null;
  isConfirmed?: boolean;
};

type HiringNote = {
  recommendation: string | null;
};

type HiringTaskInput = {
  applicationId: string;
  applicantName: string;
  positionTitle: string;
  chapterName: string;
  interviewRequired: boolean;
  submittedAt: Date;
  slots: HiringSlot[];
  notes: HiringNote[];
  decisionAccepted: boolean | null;
  audience: InterviewTaskAudience;
  viewerRole: "applicant" | "reviewer";
};

type ReadinessSlot = {
  id: string;
  status: string;
  scheduledAt: Date;
  completedAt?: Date | null;
};

type ReadinessRequest = {
  id: string;
  status: string;
  createdAt: Date;
};

type ReadinessTaskInput = {
  gateId: string;
  instructorId: string;
  instructorName: string;
  chapterName: string;
  gateStatus: string;
  outcome: string | null;
  slots: ReadinessSlot[];
  pendingRequests: ReadinessRequest[];
  audience: InterviewTaskAudience;
  viewerRole: "instructor" | "reviewer";
};

export function toDateTimeLocal(value: Date) {
  const local = new Date(value);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function isGateFinal(status: string) {
  return status === "PASSED" || status === "WAIVED";
}

function isApplicationFinal(decisionAccepted: boolean | null) {
  return decisionAccepted !== null;
}

function findFirstSlot(slots: HiringSlot[], status: string) {
  return slots.find((slot) => slot.status === status);
}

function findFirstReadinessSlot(slots: ReadinessSlot[], status: string) {
  return slots.find((slot) => slot.status === status);
}

export function buildHiringInterviewTask(input: HiringTaskInput): InterviewTask {
  const postedSlot = findFirstSlot(input.slots, "POSTED");
  const confirmedSlot = findFirstSlot(input.slots, "CONFIRMED");
  const completedSlot =
    findFirstSlot(input.slots, "COMPLETED") ??
    input.slots.find((slot) => Boolean(slot.completedAt));
  const hasRecommendation = input.notes.some((note) => note.recommendation !== null);
  const href = `/applications/${input.applicationId}`;

  if (isApplicationFinal(input.decisionAccepted)) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "COMPLETED",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Decision posted`,
      detail: "Interview workflow is complete.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "open_details",
        label: "Open Application",
        href,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: [],
      timestamps: {
        submittedAt: input.submittedAt,
        scheduledAt: confirmedSlot?.scheduledAt ?? postedSlot?.scheduledAt ?? null,
        completedAt: completedSlot?.completedAt ?? null,
      },
    };
  }

  if (input.viewerRole === "applicant") {
    if (postedSlot) {
      return {
        id: `hiring-${input.applicationId}`,
        domain: "HIRING",
        audience: input.audience,
        stage: "NEEDS_ACTION",
        title: `${input.positionTitle}`,
        subtitle: `${input.chapterName} · Confirm your interview`,
        detail: `Interview slot posted for ${formatDateTime(postedSlot.scheduledAt)}.`,
        ownerName: input.applicantName,
        href,
        primaryAction: {
          kind: "confirm_hiring_slot",
          label: "Confirm Interview Slot",
          slotId: postedSlot.id,
        },
        secondaryLinks: [{ label: "Open Application", href }],
        blockers: [],
        timestamps: {
          submittedAt: input.submittedAt,
          scheduledAt: postedSlot.scheduledAt,
        },
      };
    }

    if (confirmedSlot) {
      return {
        id: `hiring-${input.applicationId}`,
        domain: "HIRING",
        audience: input.audience,
        stage: "SCHEDULED",
        title: `${input.positionTitle}`,
        subtitle: `${input.chapterName} · Interview confirmed`,
        detail: `Interview is scheduled for ${formatDateTime(confirmedSlot.scheduledAt)}.`,
        ownerName: input.applicantName,
        href,
        primaryAction: {
          kind: "open_details",
          label: "View Interview Details",
          href,
        },
        secondaryLinks: [{ label: "Open Application", href }],
        blockers: [],
        timestamps: {
          submittedAt: input.submittedAt,
          scheduledAt: confirmedSlot.scheduledAt,
        },
      };
    }

    if (completedSlot) {
      return {
        id: `hiring-${input.applicationId}`,
        domain: "HIRING",
        audience: input.audience,
        stage: "COMPLETED",
        title: `${input.positionTitle}`,
        subtitle: `${input.chapterName} · Interview complete`,
        detail: "Interview completed. Waiting for final decision.",
        ownerName: input.applicantName,
        href,
        primaryAction: {
          kind: "open_details",
          label: "View Application Status",
          href,
        },
        secondaryLinks: [{ label: "Open Application", href }],
        blockers: [],
        timestamps: {
          submittedAt: input.submittedAt,
          completedAt: completedSlot.completedAt ?? completedSlot.scheduledAt,
        },
      };
    }

    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "BLOCKED",
      title: `${input.positionTitle}`,
      subtitle: `${input.chapterName} · Waiting for interviewer`,
      detail: "No interview slot posted yet.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "open_details",
        label: "Open Application",
        href,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: ["Waiting for reviewer to post interview slot."],
      timestamps: {
        submittedAt: input.submittedAt,
      },
    };
  }

  if (!input.interviewRequired) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "COMPLETED",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Interview optional`,
      detail: "Interview is optional for this position.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "open_details",
        label: "Open Application",
        href,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: [],
      timestamps: {
        submittedAt: input.submittedAt,
      },
    };
  }

  if (confirmedSlot) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "NEEDS_ACTION",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Confirmed interview`,
      detail: "Finish interview and capture recommendation in one step.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "complete_hiring_interview_and_note",
        label: "Complete + Save Recommendation",
        applicationId: input.applicationId,
        slotId: confirmedSlot.id,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: [],
      timestamps: {
        submittedAt: input.submittedAt,
        scheduledAt: confirmedSlot.scheduledAt,
      },
    };
  }

  if (completedSlot && !hasRecommendation) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "NEEDS_ACTION",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Recommendation missing`,
      detail: "Add recommendation note to unblock final decision.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "add_hiring_recommendation_note",
        label: "Add Recommendation Note",
        applicationId: input.applicationId,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: ["A recommendation is required before decision."],
      timestamps: {
        submittedAt: input.submittedAt,
        completedAt: completedSlot.completedAt ?? completedSlot.scheduledAt,
      },
    };
  }

  if (completedSlot && hasRecommendation) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "COMPLETED",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Decision ready`,
      detail: "Interview and recommendation complete.",
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "open_details",
        label: "Open Decision Workspace",
        href,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: [],
      timestamps: {
        submittedAt: input.submittedAt,
        completedAt: completedSlot.completedAt ?? completedSlot.scheduledAt,
      },
    };
  }

  if (postedSlot) {
    return {
      id: `hiring-${input.applicationId}`,
      domain: "HIRING",
      audience: input.audience,
      stage: "BLOCKED",
      title: `${input.applicantName} · ${input.positionTitle}`,
      subtitle: `${input.chapterName} · Waiting for applicant`,
      detail: `Posted slot waiting confirmation (${formatDateTime(postedSlot.scheduledAt)}).`,
      ownerName: input.applicantName,
      href,
      primaryAction: {
        kind: "open_details",
        label: "Open Application",
        href,
      },
      secondaryLinks: [{ label: "Open Application", href }],
      blockers: ["Applicant confirmation pending."],
      timestamps: {
        submittedAt: input.submittedAt,
        scheduledAt: postedSlot.scheduledAt,
      },
    };
  }

  return {
    id: `hiring-${input.applicationId}`,
    domain: "HIRING",
    audience: input.audience,
    stage: "NEEDS_ACTION",
    title: `${input.applicantName} · ${input.positionTitle}`,
    subtitle: `${input.chapterName} · No interview slots`,
    detail: "Post up to three interview options in one step.",
    ownerName: input.applicantName,
    href,
    primaryAction: {
      kind: "post_hiring_slots_bulk",
      label: "Post Interview Slots",
      applicationId: input.applicationId,
      defaultDateTimeLocal: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    },
    secondaryLinks: [{ label: "Open Application", href }],
    blockers: [],
    timestamps: {
      submittedAt: input.submittedAt,
    },
  };
}

export function buildReadinessInterviewTask(input: ReadinessTaskInput): InterviewTask {
  const postedSlot = findFirstReadinessSlot(input.slots, "POSTED");
  const confirmedSlot = findFirstReadinessSlot(input.slots, "CONFIRMED");
  const completedSlot = findFirstReadinessSlot(input.slots, "COMPLETED");
  const pendingRequest = input.pendingRequests[0];
  const trainingHref = "/instructor-training";
  const hubHref = "/interviews?scope=readiness";
  const openHref = input.viewerRole === "instructor" ? trainingHref : hubHref;

  if (isGateFinal(input.gateStatus)) {
    return {
      id: `readiness-${input.gateId}`,
      domain: "READINESS",
      audience: input.audience,
      stage: "COMPLETED",
      title: `${input.instructorName} · Instructor Readiness`,
      subtitle: `${input.chapterName} · ${input.gateStatus.replace(/_/g, " ")}`,
      detail: "Interview gate finalized.",
      ownerName: input.instructorName,
      href: openHref,
      primaryAction: {
        kind: "open_details",
        label: "View Readiness Details",
        href: openHref,
      },
      secondaryLinks: [{ label: "Open Readiness", href: openHref }],
      blockers: [],
      timestamps: {
        scheduledAt: confirmedSlot?.scheduledAt ?? postedSlot?.scheduledAt ?? null,
        completedAt: completedSlot?.completedAt ?? null,
      },
    };
  }

  if (input.viewerRole === "instructor") {
    if (postedSlot) {
      return {
        id: `readiness-${input.gateId}`,
        domain: "READINESS",
        audience: input.audience,
        stage: "NEEDS_ACTION",
        title: "Instructor Interview Readiness",
        subtitle: `${input.chapterName} · Confirm posted interview slot`,
        detail: `Slot posted for ${formatDateTime(postedSlot.scheduledAt)}.`,
        ownerName: input.instructorName,
        href: trainingHref,
        primaryAction: {
          kind: "confirm_readiness_slot",
          label: "Confirm Interview Slot",
          slotId: postedSlot.id,
        },
        secondaryLinks: [{ label: "Open Training Academy", href: trainingHref }],
        blockers: [],
        timestamps: {
          scheduledAt: postedSlot.scheduledAt,
        },
      };
    }

    if (confirmedSlot) {
      return {
        id: `readiness-${input.gateId}`,
        domain: "READINESS",
        audience: input.audience,
        stage: "SCHEDULED",
        title: "Instructor Interview Readiness",
        subtitle: `${input.chapterName} · Interview confirmed`,
        detail: `Interview scheduled for ${formatDateTime(confirmedSlot.scheduledAt)}.`,
        ownerName: input.instructorName,
        href: trainingHref,
        primaryAction: {
          kind: "open_details",
          label: "View Training Details",
          href: trainingHref,
        },
        secondaryLinks: [{ label: "Open Training Academy", href: trainingHref }],
        blockers: [],
        timestamps: {
          scheduledAt: confirmedSlot.scheduledAt,
        },
      };
    }

    if (pendingRequest) {
      return {
        id: `readiness-${input.gateId}`,
        domain: "READINESS",
        audience: input.audience,
        stage: "BLOCKED",
        title: "Instructor Interview Readiness",
        subtitle: `${input.chapterName} · Availability submitted`,
        detail: "Waiting for reviewer to accept one of your preferred times.",
        ownerName: input.instructorName,
        href: trainingHref,
        primaryAction: {
          kind: "open_details",
          label: "View Request",
          href: trainingHref,
        },
        secondaryLinks: [{ label: "Open Training Academy", href: trainingHref }],
        blockers: ["Reviewer scheduling action is pending."],
        timestamps: {
          scheduledAt: null,
        },
      };
    }

    return {
      id: `readiness-${input.gateId}`,
      domain: "READINESS",
      audience: input.audience,
      stage: "NEEDS_ACTION",
      title: "Instructor Interview Readiness",
      subtitle: `${input.chapterName} · Submit preferred times`,
      detail: "Share your availability to get interview scheduled.",
      ownerName: input.instructorName,
      href: trainingHref,
      primaryAction: {
        kind: "request_readiness_availability",
        label: "Submit Availability",
        instructorId: input.instructorId,
        defaultDateTimeLocal: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      },
      secondaryLinks: [{ label: "Open Training Academy", href: trainingHref }],
      blockers: [],
      timestamps: {
        scheduledAt: null,
      },
    };
  }

  if (pendingRequest) {
    return {
      id: `readiness-${input.gateId}`,
      domain: "READINESS",
      audience: input.audience,
      stage: "NEEDS_ACTION",
      title: `${input.instructorName} · Interview Availability`,
      subtitle: `${input.chapterName} · Request pending review`,
      detail: "Accept an availability request and lock the interview time.",
      ownerName: input.instructorName,
      href: hubHref,
      primaryAction: {
        kind: "accept_readiness_request",
        label: "Accept + Schedule",
        requestId: pendingRequest.id,
        defaultDateTimeLocal: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
      },
      secondaryLinks: [{ label: "Open Interview Hub", href: hubHref }],
      blockers: [],
      timestamps: {
        scheduledAt: null,
      },
    };
  }

  if (confirmedSlot || completedSlot) {
    return {
      id: `readiness-${input.gateId}`,
      domain: "READINESS",
      audience: input.audience,
      stage: "NEEDS_ACTION",
      title: `${input.instructorName} · Interview Outcome`,
      subtitle: `${input.chapterName} · ${confirmedSlot ? "Confirmed slot" : "Completed interview"}`,
      detail: "Complete interview and set outcome in one action.",
      ownerName: input.instructorName,
      href: hubHref,
      primaryAction: {
        kind: "complete_readiness_interview_and_outcome",
        label: "Complete + Set Outcome",
        gateId: input.gateId,
        slotId: confirmedSlot?.id ?? completedSlot?.id,
      },
      secondaryLinks: [{ label: "Open Interview Hub", href: hubHref }],
      blockers: [],
      timestamps: {
        scheduledAt: confirmedSlot?.scheduledAt ?? completedSlot?.scheduledAt ?? null,
        completedAt: completedSlot?.completedAt ?? null,
      },
    };
  }

  return {
    id: `readiness-${input.gateId}`,
    domain: "READINESS",
    audience: input.audience,
    stage: input.gateStatus === "FAILED" || input.gateStatus === "HOLD" ? "BLOCKED" : "NEEDS_ACTION",
    title: `${input.instructorName} · Interview Scheduling`,
    subtitle: `${input.chapterName} · ${input.gateStatus.replace(/_/g, " ")}`,
    detail: "Post multiple interview slot options in one step.",
    ownerName: input.instructorName,
    href: hubHref,
    primaryAction: {
      kind: "post_readiness_slots_bulk",
      label: "Post Interview Slots",
      gateId: input.gateId,
      instructorId: input.instructorId,
      defaultDateTimeLocal: toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    },
    secondaryLinks: [{ label: "Open Interview Hub", href: hubHref }],
    blockers:
      input.gateStatus === "FAILED" || input.gateStatus === "HOLD"
        ? ["Previous interview outcome requires follow-up scheduling."]
        : [],
    timestamps: {
      scheduledAt: null,
    },
  };
}

export function matchesInterviewState(stage: InterviewStage, state: string) {
  if (state === "all") return true;
  if (state === "needs_action") return stage === "NEEDS_ACTION";
  if (state === "scheduled") return stage === "SCHEDULED";
  if (state === "completed") return stage === "COMPLETED";
  if (state === "blocked") return stage === "BLOCKED";
  return true;
}
