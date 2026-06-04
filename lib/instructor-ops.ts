import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  getInstructorReadinessMany,
  type InstructorReadiness,
} from "@/lib/instructor-readiness";
import {
  computeInstructorCompleteness,
  type InstructorCompleteness,
} from "@/lib/instructor-completeness";

export type InstructorOpsStage =
  | "APPLICANTS"
  | "INTERVIEW"
  | "REVIEW"
  | "ONBOARDING"
  | "READY"
  | "ACTIVE"
  | "LEADERSHIP"
  | "PAUSED"
  | "NEEDS_ATTENTION";

export type AttentionTone = "critical" | "warning" | "info";

export type InstructorAttentionFlag = {
  kind: string;
  title: string;
  detail: string;
  tone: AttentionTone;
  href: string;
};

export type InstructorOpsRecord = {
  id: string;
  status: InstructorOpsStage;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  chapterId: string | null;
  chapterName: string;
  chapterLocation: string | null;
  roles: string[];
  isInstructor: boolean;
  isApplicant: boolean;
  stage: InstructorOpsStage;
  stageLabel: string;
  stageDetail: string;
  stageEnteredAt: string | null;
  assignmentCount: number;
  activeAssignmentCount: number;
  coInstructorAssignmentCount: number;
  courseCount: number;
  currentLoadLabel: "Waiting" | "Available" | "Active" | "Overloaded";
  trainingCompleted: number;
  trainingTotal: number;
  trainingPercent: number;
  onboardingComplete: boolean;
  interviewStatus: string;
  readinessComplete: boolean;
  canRequestOfferingApproval: boolean;
  mentorName: string | null;
  mentorId: string | null;
  menteeCount: number;
  mentorEligible: boolean;
  workshopEligible: boolean;
  leadershipTrack: boolean;
  growthTier: string | null;
  tags: string[];
  availabilityTags: string[];
  attentionFlags: InstructorAttentionFlag[];
  needsAttention: boolean;
  application: {
    id: string;
    status: string;
    source: string;
    track: string;
    updatedAt: string;
  } | null;
  latestActivityAt: string;
  latestActivityLabel: string;
  profileHref: string;
  completeness: InstructorCompleteness;
};

export type InstructorOpsProfile = {
  record: InstructorOpsRecord;
  user: InstructorOpsUser;
  readiness: InstructorReadiness;
};

export type InstructorOpsActivity = {
  id: string;
  instructorId: string;
  instructorName: string;
  label: string;
  detail: string;
  occurredAt: string;
  href: string;
};

export const INSTRUCTOR_OPS_STAGE_LABELS: Record<InstructorOpsStage, string> = {
  APPLICANTS: "Applicants",
  INTERVIEW: "Interview",
  REVIEW: "Review",
  ONBOARDING: "Onboarding",
  READY: "Ready",
  ACTIVE: "Active",
  LEADERSHIP: "Leadership",
  PAUSED: "Paused",
  NEEDS_ATTENTION: "Needs Attention",
};

export const INSTRUCTOR_OPS_STAGE_ORDER: InstructorOpsStage[] = [
  "APPLICANTS",
  "INTERVIEW",
  "REVIEW",
  "ONBOARDING",
  "READY",
  "ACTIVE",
  "LEADERSHIP",
  "PAUSED",
  "NEEDS_ATTENTION",
];

const INSTRUCTOR_OPS_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  primaryRole: true,
  chapterId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: true } },
  chapter: { select: { id: true, name: true, city: true, region: true } },
  profile: {
    select: {
      avatarUrl: true,
      bio: true,
      interests: true,
      city: true,
      stateProvince: true,
      school: true,
      mentorCapacity: true,
      mentorAvailability: true,
    },
  },
  onboarding: {
    select: {
      currentStep: true,
      profileCompleted: true,
      completedAt: true,
      updatedAt: true,
    },
  },
  trainings: {
    select: {
      id: true,
      status: true,
      completedAt: true,
      module: {
        select: {
          id: true,
          title: true,
          required: true,
          sortOrder: true,
          contentKey: true,
        },
      },
    },
    orderBy: { module: { sortOrder: "asc" } },
  },
  interviewGate: {
    select: {
      status: true,
      outcome: true,
      scheduledAt: true,
      completedAt: true,
      updatedAt: true,
    },
  },
  instructorApplications: {
    select: {
      id: true,
      status: true,
      source: true,
      applicationTrack: true,
      instructorSubtype: true,
      subjectsOfInterest: true,
      availability: true,
      hoursPerWeek: true,
      city: true,
      stateProvince: true,
      schoolName: true,
      reviewerAssignedAt: true,
      chairQueuedAt: true,
      materialsReadyAt: true,
      interviewScheduledAt: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      reviewer: { select: { id: true, name: true } },
      interviewerAssignments: {
        where: { removedAt: null },
        select: {
          id: true,
          role: true,
          assignedAt: true,
          interviewer: { select: { id: true, name: true } },
        },
      },
      applicationReviews: {
        select: {
          overallRating: true,
          nextStep: true,
          summary: true,
          flagForLeadership: true,
          submittedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
      interviewReviews: {
        select: {
          recommendation: true,
          overallRating: true,
          flagForLeadership: true,
          submittedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
      chairDecisions: {
        where: { supersededAt: null },
        select: { action: true, decidedAt: true, rationale: true },
        orderBy: { decidedAt: "desc" },
        take: 1,
      },
      timeline: {
        select: {
          id: true,
          kind: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  },
  classOfferingsInstructed: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      meetingDays: true,
      meetingTime: true,
      deliveryMode: true,
      locationName: true,
      semester: true,
      grandfatheredTrainingExemption: true,
      updatedAt: true,
      chapter: { select: { id: true, name: true } },
      template: {
        select: {
          title: true,
          interestArea: true,
          difficultyLevel: true,
        },
      },
      approval: {
        select: {
          status: true,
          requestedAt: true,
          reviewedAt: true,
          reviewNotes: true,
        },
      },
      _count: { select: { enrollments: true, sessions: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 12,
  },
  courses: {
    select: {
      id: true,
      title: true,
      interestArea: true,
      createdAt: true,
      updatedAt: true,
      chapter: { select: { id: true, name: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  },
  coInstructorAssignments: {
    select: {
      id: true,
      role: true,
      addedAt: true,
      course: {
        select: {
          id: true,
          title: true,
          interestArea: true,
          chapter: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { addedAt: "desc" },
    take: 8,
  },
  menteePairs: {
    where: { type: "INSTRUCTOR" },
    select: {
      id: true,
      status: true,
      startDate: true,
      mentor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startDate: "desc" },
    take: 5,
  },
  mentorPairs: {
    where: { type: "INSTRUCTOR" },
    select: {
      id: true,
      status: true,
      startDate: true,
      mentee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startDate: "desc" },
    take: 12,
  },
  instructorGrowthProfile: {
    select: {
      currentTier: true,
      lifetimeXp: true,
      currentSemesterXp: true,
      approvedEventCount: true,
      pendingEventCount: true,
      badgeCount: true,
      lastEvaluatedAt: true,
    },
  },
  instructorGrowthEvents: {
    select: {
      id: true,
      category: true,
      status: true,
      title: true,
      xpAmount: true,
      occurredAt: true,
      createdAt: true,
    },
    orderBy: { occurredAt: "desc" },
    take: 8,
  },
  instructorCertifications: {
    select: {
      id: true,
      certType: true,
      passionArea: true,
      status: true,
      totalRequired: true,
      totalCompleted: true,
      progressPct: true,
      submittedAt: true,
      reviewedAt: true,
      certifiedAt: true,
      expiresAt: true,
      reviewerNotes: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  },
  teachingPermissions: {
    select: {
      id: true,
      level: true,
      reason: true,
      grantedAt: true,
      grantedBy: { select: { id: true, name: true } },
    },
    orderBy: { grantedAt: "desc" },
  },
  approvals: {
    select: {
      id: true,
      status: true,
      notes: true,
      updatedAt: true,
      levels: { select: { level: true, approvedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
  },
  instructorCohortMemberships: {
    select: {
      id: true,
      addedAt: true,
      cohort: {
        select: {
          id: true,
          name: true,
          chapter: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { addedAt: "desc" },
  },
} as const;

export type InstructorOpsUser = any;

const ACTIVE_APPLICATION_STATUSES = new Set([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFO_REQUESTED",
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
  "ON_HOLD",
  "WAITLISTED",
]);

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["PUBLISHED", "IN_PROGRESS"]);
const LEADERSHIP_TIERS = new Set(["LEADER", "LUMINARY", "FELLOW"]);

function daysSince(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return null;
  return Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000);
}

function titleize(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function splitLooseTags(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(/[,;\n]+/)
    .map((tag) => titleize(tag.trim()))
    .filter(Boolean);
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function compactUnique(values: Array<string | null | undefined>, max = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length >= max) break;
  }
  return result;
}

function latestDateIso(values: Array<Date | string | null | undefined>) {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value as Date | string))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0]?.toISOString() ?? new Date(0).toISOString();
}

function getCurrentApplication(user: InstructorOpsUser) {
  const applications = asArray(user.instructorApplications);
  const active = applications.find(
    (application: any) =>
      !application.archivedAt && ACTIVE_APPLICATION_STATUSES.has(application.status)
  );
  return active ?? applications[0] ?? null;
}

function getActiveMentor(user: InstructorOpsUser) {
  return asArray(user.menteePairs).find((pair: any) => pair.status === "ACTIVE")?.mentor ?? null;
}

function getLeadershipTrack(user: InstructorOpsUser) {
  const growthTier = user.instructorGrowthProfile?.currentTier ?? null;
  const flaggedApplication = asArray(user.instructorApplications).some((application: any) => {
    return (
      asArray(application.applicationReviews).some((review: any) => review.flagForLeadership) ||
      asArray(application.interviewReviews).some((review: any) => review.flagForLeadership)
    );
  });
  const isMentor = asArray(user.roles).some((role: any) => role.role === "MENTOR");
  return Boolean(
    (growthTier && LEADERSHIP_TIERS.has(growthTier)) ||
      flaggedApplication ||
      isMentor ||
      asArray(user.mentorPairs).some((pair: any) => pair.status === "ACTIVE")
  );
}

function getAvailabilityTags(user: InstructorOpsUser) {
  const application = getCurrentApplication(user);
  const availability = [
    application?.availability ?? "",
    user.profile?.mentorAvailability ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const tags: string[] = [];
  if (availability.includes("weekend")) tags.push("Weekends");
  if (availability.includes("evening")) tags.push("Evenings");
  if (availability.includes("weekday")) tags.push("Weekdays");
  if (availability.includes("virtual") || availability.includes("online")) tags.push("Virtual");
  if (availability.includes("in person") || availability.includes("in-person")) tags.push("In Person");
  return compactUnique(tags, 5);
}

function buildTags({
  user,
  readiness,
  assignmentInterestAreas,
}: {
  user: InstructorOpsUser;
  readiness: InstructorReadiness;
  assignmentInterestAreas: string[];
}) {
  const application = getCurrentApplication(user);
  const roleTags = asArray(user.roles).map((role: any) => titleize(role.role));
  const profileInterests = asArray(user.profile?.interests).map((interest: any) =>
    titleize(String(interest))
  );
  const subjectTags = splitLooseTags(application?.subjectsOfInterest);
  const availabilityTags = getAvailabilityTags(user);
  const locationTags = compactUnique([
    user.chapter?.name,
    user.chapter?.city,
    application?.city,
    application?.stateProvince,
  ], 4);
  const specialTags = [
    application?.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR"
      ? "Workshop Eligible"
      : null,
    asArray(user.roles).some((role: any) => role.role === "MENTOR") ? "Mentor" : null,
    getLeadershipTrack(user) ? "Leadership" : null,
    readiness.canRequestOfferingApproval ? "Ready" : null,
    user.instructorGrowthProfile?.currentTier
      ? titleize(user.instructorGrowthProfile.currentTier)
      : null,
  ];

  return compactUnique(
    [
      ...specialTags,
      ...subjectTags,
      ...profileInterests,
      ...assignmentInterestAreas.map(titleize),
      ...availabilityTags,
      ...locationTags,
      ...roleTags,
    ],
    12
  );
}

function buildAttentionFlags({
  user,
  readiness,
  activeAssignmentCount,
  assignmentCount,
}: {
  user: InstructorOpsUser;
  readiness: InstructorReadiness;
  activeAssignmentCount: number;
  assignmentCount: number;
}) {
  const flags: InstructorAttentionFlag[] = [];
  const application = getCurrentApplication(user);
  const isInstructor = asArray(user.roles).some((role: any) => role.role === "INSTRUCTOR");

  if (application && !application.archivedAt) {
    const reviewAge = daysSince(application.reviewerAssignedAt);
    const updateAge = daysSince(application.updatedAt) ?? 0;
    const chairAge = daysSince(application.chairQueuedAt);

    if (application.status === "UNDER_REVIEW" && reviewAge !== null && reviewAge >= 5) {
      flags.push({
        kind: "stalled_application_review",
        title: "Review stalled",
        detail: `${reviewAge} days since reviewer assignment.`,
        tone: "critical",
        href: `/admin/instructor-applicants/${application.id}`,
      });
    }

    if (application.status === "INTERVIEW_COMPLETED" && updateAge >= 7) {
      flags.push({
        kind: "post_interview_stuck",
        title: "Post-interview stuck",
        detail: `${updateAge} days since interview completion update.`,
        tone: "critical",
        href: `/admin/instructor-applicants/${application.id}`,
      });
    }

    if (
      application.status === "INTERVIEW_SCHEDULED" &&
      !application.interviewScheduledAt &&
      updateAge >= 5
    ) {
      flags.push({
        kind: "interview_slots_needed",
        title: "Interview scheduling needs action",
        detail: "No confirmed interview time after 5 days.",
        tone: "warning",
        href: `/admin/instructor-applicants/${application.id}`,
      });
    }

    if (application.status === "CHAIR_REVIEW" && chairAge !== null && chairAge >= 3) {
      flags.push({
        kind: "chair_review_waiting",
        title: "Chair review waiting",
        detail: `${chairAge} days in chair review.`,
        tone: "warning",
        href: `/admin/instructor-applicants/chair-queue/${application.id}`,
      });
    }
  }

  if (isInstructor && readiness.missingRequirements.length > 0) {
    flags.push({
      kind: "onboarding_incomplete",
      title: "Onboarding blocker",
      detail: readiness.missingRequirements[0]?.title ?? "Readiness requirements are incomplete.",
      tone: "warning",
      href: readiness.nextAction.href,
    });
  }

  const pendingApprovalCount = asArray(user.classOfferingsInstructed).filter((offering: any) =>
    offering.approval?.status === "REQUESTED" ||
    offering.approval?.status === "UNDER_REVIEW"
  ).length;
  if (pendingApprovalCount > 0) {
    flags.push({
      kind: "offering_approval_pending",
      title: "Offering approval pending",
      detail: `${pendingApprovalCount} class proposal${pendingApprovalCount === 1 ? "" : "s"} need review.`,
      tone: "warning",
      href: "/admin/classes?tab=review",
    });
  }

  const revisionCount = asArray(user.classOfferingsInstructed).filter((offering: any) =>
    offering.approval?.status === "CHANGES_REQUESTED" ||
    offering.approval?.status === "REJECTED"
  ).length;
  if (revisionCount > 0) {
    flags.push({
      kind: "offering_changes_requested",
      title: "Class changes requested",
      detail: `${revisionCount} class proposal${revisionCount === 1 ? "" : "s"} need updates.`,
      tone: "critical",
      href: "/admin/classes?tab=review",
    });
  }

  const activeMentor = getActiveMentor(user);
  if (isInstructor && !activeMentor) {
    flags.push({
      kind: "mentor_missing",
      title: "No active mentor",
      detail: "Instructor has no active instructor mentor relationship.",
      tone: "info",
      href: "/admin/mentorship?tab=assignments",
    });
  }

  if (isInstructor && readiness.canRequestOfferingApproval && assignmentCount === 0) {
    flags.push({
      kind: "ready_no_assignment",
      title: "Ready but unassigned",
      detail: "Ready for assignment with no current class or course.",
      tone: "info",
      href: "/admin/classes",
    });
  }

  if (activeAssignmentCount >= 3) {
    flags.push({
      kind: "overloaded",
      title: "Overloaded",
      detail: `${activeAssignmentCount} active class assignments.`,
      tone: "critical",
      href: `/admin/instructors/${user.id}`,
    });
  }

  const now = new Date();
  for (const certification of asArray(user.instructorCertifications)) {
    if (!certification.expiresAt) continue;
    const days = Math.ceil(
      (certification.expiresAt.getTime() - now.getTime()) / 86_400_000
    );
    if (days < 0) {
      flags.push({
        kind: "certification_expired",
        title: "Certification expired",
        detail: `${certification.certType} expired ${Math.abs(days)} days ago.`,
        tone: "critical",
        href: `/admin/instructors/${user.id}`,
      });
    } else if (days <= 30) {
      flags.push({
        kind: "certification_expiring",
        title: "Certification expiring",
        detail: `${certification.certType} expires in ${days} days.`,
        tone: "warning",
        href: `/admin/instructors/${user.id}`,
      });
    }
  }

  return flags;
}

function getComputedStage({
  user,
  readiness,
  attentionFlags,
  activeAssignmentCount,
}: {
  user: InstructorOpsUser;
  readiness: InstructorReadiness;
  attentionFlags: InstructorAttentionFlag[];
  activeAssignmentCount: number;
}): InstructorOpsStage {
  const application = getCurrentApplication(user);
  const isInstructor = asArray(user.roles).some((role: any) => role.role === "INSTRUCTOR");
  const hasCriticalAttention = attentionFlags.some((flag) => flag.tone === "critical");

  if (hasCriticalAttention) return "NEEDS_ATTENTION";

  if (
    application?.status === "ON_HOLD" ||
    application?.status === "WAITLISTED" ||
    user.interviewGate?.status === "HOLD" ||
    user.interviewGate?.status === "FAILED" ||
    asArray(user.approvals).some((approval: any) => approval.status === "PAUSED")
  ) {
    return "PAUSED";
  }

  if (application && !isInstructor) {
    if (application.status === "SUBMITTED") return "APPLICANTS";
    if (
      application.status === "UNDER_REVIEW" ||
      application.status === "INFO_REQUESTED" ||
      application.status === "CHAIR_REVIEW"
    ) {
      return "REVIEW";
    }
    if (
      application.status === "PRE_APPROVED" ||
      application.status === "INTERVIEW_SCHEDULED" ||
      application.status === "INTERVIEW_COMPLETED"
    ) {
      return "INTERVIEW";
    }
  }

  if (!isInstructor && application?.status === "APPROVED") {
    return "ONBOARDING";
  }

  if (isInstructor && getLeadershipTrack(user)) return "LEADERSHIP";

  if (
    isInstructor &&
    (!readiness.trainingComplete ||
      !readiness.interviewPassed ||
      (user.onboarding && !user.onboarding.completedAt && !user.onboarding.profileCompleted))
  ) {
    return "ONBOARDING";
  }

  if (activeAssignmentCount > 0) return "ACTIVE";
  if (readiness.canRequestOfferingApproval) return "READY";
  if (isInstructor) return "ONBOARDING";
  return "APPLICANTS";
}

function getStageDetail(stage: InstructorOpsStage, flags: InstructorAttentionFlag[]) {
  if (stage === "NEEDS_ATTENTION" && flags[0]) return flags[0].title;
  switch (stage) {
    case "APPLICANTS":
      return "New applicant intake";
    case "INTERVIEW":
      return "Interview or scheduling stage";
    case "REVIEW":
      return "Admin review in progress";
    case "ONBOARDING":
      return "Training, interview, or setup still in progress";
    case "READY":
      return "Ready for assignment";
    case "ACTIVE":
      return "Currently assigned";
    case "LEADERSHIP":
      return "Mentor or leadership-track";
    case "PAUSED":
      return "On hold, waitlisted, or paused";
    case "NEEDS_ATTENTION":
      return "Needs admin follow-up";
  }
}

function getLoadLabel(activeAssignmentCount: number, readiness: InstructorReadiness) {
  if (activeAssignmentCount >= 3) return "Overloaded";
  if (activeAssignmentCount > 0) return "Active";
  if (readiness.canRequestOfferingApproval) return "Available";
  return "Waiting";
}

function buildOpsRecord(user: InstructorOpsUser, readiness: InstructorReadiness): InstructorOpsRecord {
  const application = getCurrentApplication(user);
  const userRoles = asArray(user.roles);
  const classOfferings = asArray(user.classOfferingsInstructed);
  const courses = asArray(user.courses);
  const coInstructorAssignments = asArray(user.coInstructorAssignments);
  const trainings = asArray(user.trainings);
  const mentorPairs = asArray(user.mentorPairs);
  const instructorGrowthEvents = asArray(user.instructorGrowthEvents);
  const instructorCertifications = asArray(user.instructorCertifications);
  const roles = userRoles.map((role: any) => role.role);
  const isInstructor = roles.includes("INSTRUCTOR");
  const isApplicant = Boolean(application && !isInstructor);
  const activeOfferings = classOfferings.filter((offering: any) =>
    ACTIVE_ASSIGNMENT_STATUSES.has(offering.status)
  );
  const assignmentCount =
    classOfferings.length +
    courses.length +
    coInstructorAssignments.length;
  const activeAssignmentCount = activeOfferings.length;
  const completedTrainings = trainings.filter((training: any) => training.status === "COMPLETE").length;
  const totalTrainings = trainings.length;
  const trainingPercent =
    totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 0;
  const mentor = getActiveMentor(user);
  const assignmentInterestAreas = compactUnique([
    ...classOfferings.map((offering: any) => offering.template.interestArea),
    ...courses.map((course: any) => course.interestArea),
    ...coInstructorAssignments.map((assignment: any) => assignment.course.interestArea),
  ], 8);
  const attentionFlags = buildAttentionFlags({
    user,
    readiness,
    activeAssignmentCount,
    assignmentCount,
  });
  const stage = getComputedStage({
    user,
    readiness,
    attentionFlags,
    activeAssignmentCount,
  });
  const availabilityTags = getAvailabilityTags(user);
  const tags = buildTags({ user, readiness, assignmentInterestAreas });
  const completeness = computeInstructorCompleteness({
    isInstructor,
    phone: user.phone,
    city: user.profile?.city ?? application?.city ?? null,
    stateProvince: user.profile?.stateProvince ?? application?.stateProvince ?? null,
    school: user.profile?.school ?? application?.schoolName ?? null,
    bio: user.profile?.bio ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
    availabilityTags,
    availabilityText: application?.availability ?? null,
    subjectTags: tags,
    hasActiveMentor: Boolean(mentor),
    trainingComplete: readiness.trainingComplete,
    profileHref: `/admin/instructors/${user.id}`,
  });
  const latestActivityAt = latestDateIso([
    user.updatedAt,
    application?.updatedAt,
    user.onboarding?.updatedAt,
    user.interviewGate?.updatedAt,
    classOfferings[0]?.updatedAt,
    courses[0]?.updatedAt,
    instructorGrowthEvents[0]?.occurredAt,
    instructorCertifications[0]?.updatedAt,
  ]);
  const latestActivityLabel =
    application && new Date(application.updatedAt).toISOString() === latestActivityAt
      ? `Application ${titleize(application.status)}`
      : classOfferings[0] &&
          new Date(classOfferings[0].updatedAt).toISOString() === latestActivityAt
        ? `Class ${classOfferings[0].title}`
        : instructorGrowthEvents[0] &&
            new Date(instructorGrowthEvents[0].occurredAt).toISOString() === latestActivityAt
          ? `Growth: ${instructorGrowthEvents[0].title}`
          : "Profile updated";

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.profile?.avatarUrl ?? null,
    chapterId: user.chapterId,
    chapterName: user.chapter?.name ?? "No chapter",
    chapterLocation: compactUnique([user.chapter?.city, user.chapter?.region], 2).join(", ") || null,
    roles,
    isInstructor,
    isApplicant,
    stage,
    stageLabel: INSTRUCTOR_OPS_STAGE_LABELS[stage],
    stageDetail: getStageDetail(stage, attentionFlags),
    stageEnteredAt: application?.updatedAt?.toISOString() ?? null,
    assignmentCount,
    activeAssignmentCount,
    coInstructorAssignmentCount: coInstructorAssignments.length,
    courseCount: courses.length,
    currentLoadLabel: getLoadLabel(activeAssignmentCount, readiness),
    trainingCompleted: completedTrainings,
    trainingTotal: totalTrainings,
    trainingPercent,
    onboardingComplete: Boolean(user.onboarding?.completedAt ?? user.onboarding?.profileCompleted),
    interviewStatus: readiness.interviewStatus,
    readinessComplete: readiness.baseReadinessComplete,
    canRequestOfferingApproval: readiness.canRequestOfferingApproval,
    mentorName: mentor?.name ?? null,
    mentorId: mentor?.id ?? null,
    menteeCount: mentorPairs.filter((pair: any) => pair.status === "ACTIVE").length,
    mentorEligible: roles.includes("MENTOR") || (user.profile?.mentorCapacity ?? 0) > 0,
    workshopEligible:
      application?.applicationTrack === "SUMMER_WORKSHOP_INSTRUCTOR" ||
      application?.instructorSubtype === "SUMMER_WORKSHOP" ||
      classOfferings.some((offering: any) =>
        offering.template.interestArea.toLowerCase().includes("workshop")
      ),
    leadershipTrack: getLeadershipTrack(user),
    growthTier: user.instructorGrowthProfile?.currentTier ?? null,
    tags,
    availabilityTags,
    attentionFlags,
    needsAttention: attentionFlags.length > 0,
    application: application
      ? {
          id: application.id,
          status: application.status,
          source: application.source,
          track: application.applicationTrack,
          updatedAt: application.updatedAt.toISOString(),
        }
      : null,
    latestActivityAt,
    latestActivityLabel,
    profileHref: `/admin/instructors/${user.id}`,
    completeness,
    status: stage,
  };
}

export const getInstructorOpsRecords = cache(async (): Promise<InstructorOpsRecord[]> => {
  const users = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { roles: { some: { role: "INSTRUCTOR" } } },
        {
          instructorApplications: {
            some: {
              archivedAt: null,
              status: { not: "WITHDRAWN" },
            },
          },
        },
      ],
    } as any,
    select: INSTRUCTOR_OPS_USER_SELECT as any,
    orderBy: { name: "asc" },
  }) as InstructorOpsUser[];

  const readinessByInstructor = await getInstructorReadinessMany(users.map((user: any) => user.id));
  return users.map((user: any) =>
    buildOpsRecord(
      user,
      readinessByInstructor.get(user.id) ??
        ({
          instructorId: user.id,
          featureEnabled: false,
          instructorSubtype: "STANDARD",
          requiredModulesCount: 0,
          completedRequiredModules: 0,
          academyModulesComplete: true,
          studioCapstoneComplete: true,
          studioCapstoneInReview: false,
          trainingComplete: true,
          interviewStatus: user.interviewGate?.status ?? "REQUIRED",
          interviewOutcome: user.interviewGate?.outcome ?? null,
          interviewPassed: user.interviewGate?.status === "PASSED" || user.interviewGate?.status === "WAIVED",
          baseReadinessComplete: true,
          canRequestOfferingApproval: true,
          legacyExemptOfferingCount: 0,
          missingRequirements: [],
          nextAction: {
            title: "Ready",
            detail: "No readiness blockers found.",
            href: "/admin/classes",
          },
          lessonDesignStudioGate: { unlocked: true, reason: "READINESS_CHECK_NOT_IMPORTED" },
        } satisfies InstructorReadiness)
    )
  );
});

export const getInstructorOpsProfile = cache(
  async (instructorId: string): Promise<InstructorOpsProfile | null> => {
    const user = await prisma.user.findUnique({
      where: { id: instructorId },
      select: INSTRUCTOR_OPS_USER_SELECT as any,
    }) as InstructorOpsUser | null;
    if (!user || user.archivedAt) return null;

    const readinessByInstructor = await getInstructorReadinessMany([user.id]);
    const readiness = readinessByInstructor.get(user.id);
    if (!readiness) return null;

    return {
      user,
      readiness,
      record: buildOpsRecord(user, readiness),
    };
  }
);

export function getInstructorOpsMetrics(records: InstructorOpsRecord[]) {
  const byStage = new Map<InstructorOpsStage, number>();
  for (const stage of INSTRUCTOR_OPS_STAGE_ORDER) byStage.set(stage, 0);
  for (const record of records) {
    byStage.set(record.stage, (byStage.get(record.stage) ?? 0) + 1);
  }

  return {
    total: records.length,
    attention: records.filter((record) => record.needsAttention).length,
    applicants: byStage.get("APPLICANTS") ?? 0,
    interview: byStage.get("INTERVIEW") ?? 0,
    review: byStage.get("REVIEW") ?? 0,
    onboarding: byStage.get("ONBOARDING") ?? 0,
    ready: byStage.get("READY") ?? 0,
    active: byStage.get("ACTIVE") ?? 0,
    leadership: byStage.get("LEADERSHIP") ?? 0,
    paused: byStage.get("PAUSED") ?? 0,
    activeAssignments: records.reduce((sum, record) => sum + record.activeAssignmentCount, 0),
    overloaded: records.filter((record) => record.currentLoadLabel === "Overloaded").length,
    unassignedReady: records.filter(
      (record) => record.currentLoadLabel === "Available" && record.assignmentCount === 0
    ).length,
  };
}

export function getInstructorOpsRecentActivity(
  records: InstructorOpsRecord[],
  take = 8
): InstructorOpsActivity[] {
  return records
    .toSorted(
      (a, b) =>
        new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime()
    )
    .slice(0, take)
    .map((record) => ({
      id: `${record.id}-${record.latestActivityAt}`,
      instructorId: record.id,
      instructorName: record.name,
      label: record.latestActivityLabel,
      detail: `${record.stageLabel} | ${record.chapterName}`,
      occurredAt: record.latestActivityAt,
      href: record.profileHref,
    }));
}

export function formatInstructorOpsDate(value: string | Date | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatInstructorOpsDateTime(value: string | Date | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatInstructorOpsLabel(value: string | null | undefined) {
  return titleize(value);
}
