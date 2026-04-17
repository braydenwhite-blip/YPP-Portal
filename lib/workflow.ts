import {
  AdminSubtype,
  ChapterPresidentApplicationStatus,
  InstructorApplicationStatus,
  RoleType,
  StudentIntakeCaseStatus,
  WorkflowAssignmentTargetType,
  WorkflowCommentKind,
  WorkflowKind,
  WorkflowStage,
  WorkflowStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  ADMIN_SUBTYPE_LABELS,
  normalizeAdminSubtype,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";

type AssignmentResult = {
  assigneeUserId: string | null;
  assigneeSubtype: AdminSubtypeValue | null;
  assignmentTargetType: WorkflowAssignmentTargetType;
  assignmentReason: string;
};

type WorkflowUpsertInput = {
  kind: WorkflowKind;
  stage: WorkflowStage;
  status: WorkflowStatus;
  title: string;
  summary?: string | null;
  href: string;
  sourceType: string;
  sourceId: string;
  chapterId?: string | null;
  subjectUserId?: string | null;
  dueAt?: Date | null;
  allowedAssigneeRole?: RoleType | null;
  allowedAdminSubtype?: AdminSubtypeValue | null;
  createdById?: string | null;
  updatedById?: string | null;
};

type WorkflowHomeInput = {
  userId: string;
  roles: string[];
  adminSubtypes?: string[];
};

function formatStage(stage: WorkflowStage) {
  return stage.replace(/_/g, " ").toLowerCase();
}

function formatAssignmentLabel(input: {
  assigneeUserName?: string | null;
  assigneeSubtype?: AdminSubtypeValue | null;
  targetType: WorkflowAssignmentTargetType;
}) {
  if (input.assigneeUserName) return input.assigneeUserName;
  if (input.assigneeSubtype) return ADMIN_SUBTYPE_LABELS[input.assigneeSubtype];
  if (input.targetType === "SUPER_ADMIN_QUEUE") return "Super Admin queue";
  return "Unassigned";
}

function normalizeAdminSubtypeValue(
  subtype: AdminSubtype | AdminSubtypeValue | null | undefined
): AdminSubtypeValue | null {
  if (!subtype) return null;
  return subtype as AdminSubtypeValue;
}

async function findDefaultOwnerForSubtype(subtype: AdminSubtypeValue) {
  const owner = await prisma.userAdminSubtype.findFirst({
    where: { subtype, isDefaultOwner: true },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (owner?.user) {
    return { userId: owner.user.id, userName: owner.user.name };
  }

  const fallbackOwner = await prisma.userAdminSubtype.findFirst({
    where: { subtype },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ isDefaultOwner: "desc" }, { createdAt: "asc" }],
  });

  return fallbackOwner?.user
    ? { userId: fallbackOwner.user.id, userName: fallbackOwner.user.name }
    : null;
}

async function findAssigneeForRole(role: string, chapterId?: string | null) {
  const candidates = await prisma.user.findMany({
    where: {
      roles: { some: { role: role as any } },
      ...(chapterId ? { chapterId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 5,
  });

  return candidates[0] ?? null;
}

function sortAssignmentRules(
  rules: Array<{
    chapterId: string | null;
    assigneeUserId: string | null;
    assigneeSubtype: AdminSubtype | null;
    assigneeRole: string | null;
    priority: number;
  }>,
  chapterId?: string | null
) {
  return [...rules].sort((a, b) => {
    const aChapterScore = a.chapterId && a.chapterId === chapterId ? 0 : 1;
    const bChapterScore = b.chapterId && b.chapterId === chapterId ? 0 : 1;
    if (aChapterScore !== bChapterScore) return aChapterScore - bChapterScore;

    const aTargetScore = a.assigneeUserId ? 0 : a.assigneeSubtype ? 1 : a.assigneeRole ? 2 : 3;
    const bTargetScore = b.assigneeUserId ? 0 : b.assigneeSubtype ? 1 : b.assigneeRole ? 2 : 3;
    if (aTargetScore !== bTargetScore) return aTargetScore - bTargetScore;

    return b.priority - a.priority;
  });
}

export async function resolveWorkflowAssignment(input: {
  kind: WorkflowKind;
  stage: WorkflowStage;
  chapterId?: string | null;
  allowedAssigneeRole?: RoleType | null;
  allowedAdminSubtype?: AdminSubtypeValue | null;
}): Promise<AssignmentResult> {
  const rules = await prisma.workflowAssignmentRule.findMany({
    where: {
      kind: input.kind,
      stage: input.stage,
      isActive: true,
      OR: input.chapterId
        ? [{ chapterId: input.chapterId }, { chapterId: null }]
        : [{ chapterId: null }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  for (const rule of sortAssignmentRules(rules, input.chapterId)) {
    if (rule.assigneeUserId) {
      const user = await prisma.user.findUnique({
        where: { id: rule.assigneeUserId },
        select: { id: true, name: true },
      });
      if (user) {
        return {
          assigneeUserId: user.id,
          assigneeSubtype: null,
          assignmentTargetType: "USER",
          assignmentReason: `Routed by workflow rule to ${user.name}.`,
        };
      }
    }

    const ruleSubtype = normalizeAdminSubtypeValue(rule.assigneeSubtype);
    if (ruleSubtype) {
      const owner = await findDefaultOwnerForSubtype(ruleSubtype);
      if (owner) {
        return {
          assigneeUserId: owner.userId,
          assigneeSubtype: ruleSubtype,
          assignmentTargetType: "ADMIN_SUBTYPE",
          assignmentReason: `Routed by workflow rule to ${ADMIN_SUBTYPE_LABELS[ruleSubtype]}.`,
        };
      }

      return {
        assigneeUserId: null,
        assigneeSubtype: ruleSubtype,
        assignmentTargetType: "ADMIN_SUBTYPE",
        assignmentReason: `Routed to ${ADMIN_SUBTYPE_LABELS[ruleSubtype]} queue.`,
      };
    }

    if (rule.assigneeRole) {
      const roleOwner = await findAssigneeForRole(rule.assigneeRole, input.chapterId);
      if (roleOwner) {
        return {
          assigneeUserId: roleOwner.id,
          assigneeSubtype: null,
          assignmentTargetType: "ROLE",
          assignmentReason: `Routed by workflow rule to ${rule.assigneeRole.replace(/_/g, " ")} owner ${roleOwner.name}.`,
        };
      }
    }
  }

  if (input.allowedAssigneeRole) {
    const roleOwner = await findAssigneeForRole(input.allowedAssigneeRole, input.chapterId);
    if (roleOwner) {
      return {
        assigneeUserId: roleOwner.id,
        assigneeSubtype: null,
        assignmentTargetType: "ROLE",
        assignmentReason: `Routed to ${input.allowedAssigneeRole.replace(/_/g, " ")} owner ${roleOwner.name}.`,
      };
    }
  }

  if (input.allowedAdminSubtype) {
    const owner = await findDefaultOwnerForSubtype(input.allowedAdminSubtype);
    if (owner) {
      return {
        assigneeUserId: owner.userId,
        assigneeSubtype: input.allowedAdminSubtype,
        assignmentTargetType: "ADMIN_SUBTYPE",
        assignmentReason: `Routed to ${ADMIN_SUBTYPE_LABELS[input.allowedAdminSubtype]}.`,
      };
    }

    return {
      assigneeUserId: null,
      assigneeSubtype: input.allowedAdminSubtype,
      assignmentTargetType: "ADMIN_SUBTYPE",
      assignmentReason: `Queued for ${ADMIN_SUBTYPE_LABELS[input.allowedAdminSubtype]}.`,
    };
  }

  const superAdmin = await findDefaultOwnerForSubtype("SUPER_ADMIN");
  if (superAdmin) {
    return {
      assigneeUserId: superAdmin.userId,
      assigneeSubtype: "SUPER_ADMIN",
      assignmentTargetType: "SUPER_ADMIN_QUEUE",
      assignmentReason: `Fell back to super admin ${superAdmin.userName}.`,
    };
  }

  return {
    assigneeUserId: null,
    assigneeSubtype: "SUPER_ADMIN",
    assignmentTargetType: "SUPER_ADMIN_QUEUE",
    assignmentReason: "Fell back to the super admin queue.",
  };
}

export async function addWorkflowComment(params: {
  workflowItemId: string;
  authorId?: string | null;
  body: string;
  kind?: WorkflowCommentKind;
}) {
  return prisma.workflowComment.create({
    data: {
      workflowItemId: params.workflowItemId,
      authorId: params.authorId ?? null,
      body: params.body,
      kind: params.kind ?? "COMMENT",
    },
  });
}

export async function upsertWorkflowItem(input: WorkflowUpsertInput) {
  const assignment = await resolveWorkflowAssignment({
    kind: input.kind,
    stage: input.stage,
    chapterId: input.chapterId,
    allowedAssigneeRole: input.allowedAssigneeRole,
    allowedAdminSubtype: input.allowedAdminSubtype,
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.workflowItem.findUnique({
      where: {
        sourceType_sourceId_kind: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          kind: input.kind,
        },
      },
      include: {
        assigneeUser: { select: { name: true } },
      },
    });

    const item = existing
      ? await tx.workflowItem.update({
          where: { id: existing.id },
          data: {
            title: input.title,
            summary: input.summary ?? null,
            href: input.href,
            stage: input.stage,
            status: input.status,
            chapterId: input.chapterId ?? null,
            subjectUserId: input.subjectUserId ?? null,
            dueAt: input.dueAt ?? null,
            assigneeUserId: assignment.assigneeUserId,
            assigneeSubtype: assignment.assigneeSubtype,
            assignmentTargetType: assignment.assignmentTargetType,
            allowedAssigneeRole: input.allowedAssigneeRole ?? null,
            allowedAdminSubtype: input.allowedAdminSubtype ?? null,
            assignmentReason: assignment.assignmentReason,
            completedAt:
              input.status === "COMPLETE"
                ? existing.completedAt ?? new Date()
                : null,
            updatedById: input.updatedById ?? null,
            lastRoutedAt: new Date(),
          },
        })
      : await tx.workflowItem.create({
          data: {
            kind: input.kind,
            stage: input.stage,
            status: input.status,
            title: input.title,
            summary: input.summary ?? null,
            href: input.href,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            chapterId: input.chapterId ?? null,
            subjectUserId: input.subjectUserId ?? null,
            dueAt: input.dueAt ?? null,
            assigneeUserId: assignment.assigneeUserId,
            assigneeSubtype: assignment.assigneeSubtype,
            assignmentTargetType: assignment.assignmentTargetType,
            allowedAssigneeRole: input.allowedAssigneeRole ?? null,
            allowedAdminSubtype: input.allowedAdminSubtype ?? null,
            assignmentReason: assignment.assignmentReason,
            completedAt: input.status === "COMPLETE" ? new Date() : null,
            createdById: input.createdById ?? null,
            updatedById: input.updatedById ?? null,
            lastRoutedAt: new Date(),
          },
        });

    const comments: Array<{ kind: WorkflowCommentKind; body: string }> = [];
    if (!existing) {
      comments.push({
        kind: "SYSTEM_STAGE_CHANGE",
        body: `Workflow created in ${formatStage(input.stage)}.`,
      });
      comments.push({
        kind: "SYSTEM_ASSIGNMENT",
        body: assignment.assignmentReason,
      });
    } else {
      if (existing.stage !== input.stage) {
        comments.push({
          kind: "SYSTEM_STAGE_CHANGE",
          body: `Stage changed from ${formatStage(existing.stage)} to ${formatStage(input.stage)}.`,
        });
      }

      if (
        existing.assigneeUserId !== assignment.assigneeUserId ||
        existing.assigneeSubtype !== assignment.assigneeSubtype ||
        existing.assignmentTargetType !== assignment.assignmentTargetType
      ) {
        comments.push({
          kind: "SYSTEM_ASSIGNMENT",
          body: assignment.assignmentReason,
        });
      }
    }

    if (comments.length > 0) {
      await tx.workflowComment.createMany({
        data: comments.map((comment) => ({
          workflowItemId: item.id,
          authorId: input.updatedById ?? input.createdById ?? null,
          kind: comment.kind,
          body: comment.body,
        })),
      });
    }

    return item;
  });
}

export async function overrideWorkflowAssignment(params: {
  workflowItemId: string;
  assigneeUserId: string;
  authorId: string;
  note?: string | null;
}) {
  const [item, assignee] = await Promise.all([
    prisma.workflowItem.findUnique({
      where: { id: params.workflowItemId },
      include: { assigneeUser: { select: { name: true } } },
    }),
    prisma.user.findUnique({
      where: { id: params.assigneeUserId },
      select: { id: true, name: true },
    }),
  ]);

  if (!item || !assignee) {
    throw new Error("Workflow item or assignee not found.");
  }

  const previousLabel = formatAssignmentLabel({
    assigneeUserName: item.assigneeUser?.name ?? null,
    assigneeSubtype: normalizeAdminSubtypeValue(item.assigneeSubtype),
    targetType: item.assignmentTargetType ?? "USER",
  });

  await prisma.workflowItem.update({
    where: { id: item.id },
    data: {
      assigneeUserId: assignee.id,
      assignmentTargetType: "USER",
      manualOverrideById: params.authorId,
      manualOverrideAt: new Date(),
      updatedById: params.authorId,
      assignmentReason: `Manually reassigned to ${assignee.name}.`,
      lastRoutedAt: new Date(),
    },
  });

  await prisma.workflowComment.create({
    data: {
      workflowItemId: item.id,
      authorId: params.authorId,
      kind: "MANUAL_OVERRIDE",
      body: `Assignment changed from ${previousLabel} to ${assignee.name}.${params.note ? ` ${params.note}` : ""}`,
    },
  });
}

function getWorkflowHomeAccess(input: WorkflowHomeInput) {
  const adminSubtypeSet = new Set(
    (input.adminSubtypes ?? [])
      .map((subtype) => normalizeAdminSubtype(subtype))
      .filter((subtype): subtype is AdminSubtypeValue => subtype !== null)
  );
  return {
    adminSubtypeSet,
    isSuperAdmin: adminSubtypeSet.has("SUPER_ADMIN"),
  };
}

export async function listWorkflowHomeItems(input: WorkflowHomeInput) {
  const { adminSubtypeSet, isSuperAdmin } = getWorkflowHomeAccess(input);

  return prisma.workflowItem.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
      OR: [
        { assigneeUserId: input.userId },
        ...(adminSubtypeSet.size > 0
          ? [{ assigneeSubtype: { in: Array.from(adminSubtypeSet) as AdminSubtype[] }, assigneeUserId: null }]
          : []),
        ...(isSuperAdmin
          ? [{ assignmentTargetType: WorkflowAssignmentTargetType.SUPER_ADMIN_QUEUE }]
          : []),
      ],
    },
    select: {
      id: true,
      title: true,
      summary: true,
      href: true,
      dueAt: true,
      kind: true,
      stage: true,
      status: true,
      subjectUser: { select: { name: true } },
    },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
    take: 8,
  });
}

function buildWorkflowMasterRows(
  groupedByUser: Array<{
    status: WorkflowStatus;
    dueAt: Date | null;
    subjectUserId: string | null;
    subjectUser: { name: string } | null;
    title: string;
  }>
) {
  return Object.values(
    groupedByUser.reduce<Record<string, {
      subjectUserId: string;
      name: string;
      total: number;
      complete: number;
      remainingTasks: Array<{ title: string; dueAt: Date | null }>;
    }>>((acc, item) => {
      if (!item.subjectUserId || !item.subjectUser?.name) {
        return acc;
      }
      const key = item.subjectUserId;
      if (!acc[key]) {
        acc[key] = {
          subjectUserId: key,
          name: item.subjectUser.name,
          total: 0,
          complete: 0,
          remainingTasks: [],
        };
      }
      acc[key].total += 1;
      if (item.status === "COMPLETE") {
        acc[key].complete += 1;
      } else {
        acc[key].remainingTasks.push({ title: item.title, dueAt: item.dueAt });
      }
      return acc;
    }, {})
  )
    .map((row) => ({
      ...row,
      progressPercent:
        row.total === 0 ? 0 : Math.round((row.complete / row.total) * 100),
      remainingTasks: row.remainingTasks.slice(0, 5),
    }))
    .sort((a, b) => {
      const aNext = a.remainingTasks[0]?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bNext = b.remainingTasks[0]?.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aNext - bNext;
    });
}

export async function listWorkflowMasterRows() {
  const groupedByUser = await prisma.workflowItem.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETE"] },
      subjectUserId: { not: null },
    },
    select: {
      status: true,
      dueAt: true,
      subjectUserId: true,
      subjectUser: { select: { name: true } },
      title: true,
    },
    orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
  });

  return buildWorkflowMasterRows(groupedByUser);
}

export async function listWorkflowHomeData(input: WorkflowHomeInput) {
  const { isSuperAdmin } = getWorkflowHomeAccess(input);
  const [items, masterRows] = await Promise.all([
    listWorkflowHomeItems(input),
    isSuperAdmin ? listWorkflowMasterRows() : Promise.resolve([]),
  ]);

  return {
    items,
    masterRows,
  };
}

function nextInstructorApplicationStage(status: InstructorApplicationStatus): WorkflowStage {
  switch (status) {
    case "SUBMITTED":
      return "CHAPTER_REVIEW";
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
    case "ON_HOLD":
      return "REVIEW";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
      return "INTERVIEW";
    case "APPROVED":
    case "REJECTED":
      return "COMPLETE";
    default:
      return "REVIEW";
  }
}

function instructorApplicationHref(status: InstructorApplicationStatus, applicationId: string) {
  switch (status) {
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
    case "ON_HOLD":
    case "APPROVED":
    case "REJECTED":
      return `/applications/instructor/${applicationId}/interview`;
    default:
      return `/applications/instructor/${applicationId}`;
  }
}

function nextChapterPresidentApplicationStage(status: ChapterPresidentApplicationStatus): WorkflowStage {
  switch (status) {
    case "SUBMITTED":
      return "REVIEW";
    case "UNDER_REVIEW":
    case "INFO_REQUESTED":
      return "REVIEW";
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED":
    case "RECOMMENDATION_SUBMITTED":
      return "INTERVIEW";
    case "APPROVED":
    case "REJECTED":
      return "COMPLETE";
    default:
      return "REVIEW";
  }
}

function nextStudentIntakeStage(status: StudentIntakeCaseStatus): WorkflowStage {
  switch (status) {
    case "DRAFT":
    case "SUBMITTED":
      return "INBOX";
    case "UNDER_REVIEW":
      return "REVIEW";
    case "APPROVED":
      return "FINAL_APPROVAL";
    case "MENTOR_PLAN_LAUNCHED":
      return "LAUNCH";
    case "REJECTED":
      return "COMPLETE";
  }
}

function workflowStatusFromTerminalState(isComplete: boolean): WorkflowStatus {
  return isComplete ? "COMPLETE" : "OPEN";
}

export async function syncInstructorApplicationWorkflow(applicationId: string) {
  const application = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        select: { id: true, name: true, chapterId: true },
      },
      reviewer: { select: { id: true } },
    },
  });

  if (!application) return null;

  const isComplete = application.status === "APPROVED" || application.status === "REJECTED";
  return upsertWorkflowItem({
    kind: "INSTRUCTOR_APPLICATION",
    stage: nextInstructorApplicationStage(application.status),
    status: workflowStatusFromTerminalState(isComplete),
    title: `${application.applicant.name} instructor application`,
    summary: `Status: ${application.status.replace(/_/g, " ")}${application.reviewer ? ` · Reviewer: ${application.reviewer.id}` : ""}`,
    href: instructorApplicationHref(application.status, application.id),
    sourceType: "InstructorApplication",
    sourceId: application.id,
    chapterId: application.applicant.chapterId,
    subjectUserId: application.applicant.id,
    dueAt:
      application.status === "SUBMITTED"
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        : application.status === "INTERVIEW_COMPLETED"
          ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
          : null,
    allowedAssigneeRole:
      application.status === "SUBMITTED" && application.applicant.chapterId
        ? "CHAPTER_PRESIDENT"
        : null,
    allowedAdminSubtype: "HIRING_ADMIN",
    updatedById: application.reviewerId ?? undefined,
  });
}

export async function syncChapterPresidentApplicationWorkflow(applicationId: string) {
  const application = await prisma.chapterPresidentApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: {
        select: { id: true, name: true, chapterId: true },
      },
    },
  });

  if (!application) return null;

  const isComplete = application.status === "APPROVED" || application.status === "REJECTED";
  return upsertWorkflowItem({
    kind: "CHAPTER_PRESIDENT_APPLICATION",
    stage: nextChapterPresidentApplicationStage(application.status),
    status: workflowStatusFromTerminalState(isComplete),
    title: `${application.applicant.name} chapter president application`,
    summary: `Status: ${application.status.replace(/_/g, " ")}`,
    href: `/admin/chapter-president-applicants#${application.id}`,
    sourceType: "ChapterPresidentApplication",
    sourceId: application.id,
    chapterId: application.chapterId ?? application.applicant.chapterId ?? null,
    subjectUserId: application.applicant.id,
    dueAt:
      application.status === "SUBMITTED"
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        : null,
    allowedAdminSubtype: "HIRING_ADMIN",
    updatedById: application.reviewerId ?? undefined,
  });
}

export async function syncStudentIntakeWorkflow(intakeCaseId: string) {
  const intakeCase = await prisma.studentIntakeCase.findUnique({
    where: { id: intakeCaseId },
    include: {
      parent: { select: { id: true, name: true } },
      reviewOwner: { select: { id: true } },
      reviewedBy: { select: { id: true } },
    },
  });

  if (!intakeCase) return null;

  const isComplete = intakeCase.status === "REJECTED" || intakeCase.status === "MENTOR_PLAN_LAUNCHED";
  return upsertWorkflowItem({
    kind: "STUDENT_INTAKE",
    stage: nextStudentIntakeStage(intakeCase.status),
    status: workflowStatusFromTerminalState(isComplete),
    title: `${intakeCase.studentName} student intake`,
    summary: intakeCase.nextAction ?? `Status: ${intakeCase.status.replace(/_/g, " ")}`,
    href: `/chapter/student-intake#case-${intakeCase.id}`,
    sourceType: "StudentIntakeCase",
    sourceId: intakeCase.id,
    chapterId: intakeCase.chapterId,
    subjectUserId: intakeCase.studentUserId ?? null,
    dueAt:
      intakeCase.status === "SUBMITTED" || intakeCase.status === "UNDER_REVIEW"
        ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        : null,
    allowedAssigneeRole: "CHAPTER_PRESIDENT",
    allowedAdminSubtype: "INTAKE_ADMIN",
    updatedById: intakeCase.reviewedById ?? intakeCase.reviewOwnerId ?? undefined,
  });
}

export async function syncMentorGoalReviewWorkflow(reviewId: string) {
  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: reviewId },
    include: {
      mentee: { select: { id: true, name: true, chapterId: true } },
      mentor: { select: { id: true } },
      chairReviewer: { select: { id: true } },
    },
  });

  if (!review) return null;

  const stage =
    review.status === "PENDING_CHAIR_APPROVAL"
      ? "CHAIR_REVIEW"
      : review.status === "APPROVED"
        ? "COMPLETE"
        : "REVIEW";
  const isComplete = review.status === "APPROVED";

  return upsertWorkflowItem({
    kind: review.status === "PENDING_CHAIR_APPROVAL" ? "MENTORSHIP_CHAIR_APPROVAL" : "MENTORSHIP_REVIEW",
    stage,
    status: workflowStatusFromTerminalState(isComplete),
    title: `${review.mentee.name} goal review`,
    summary: `Cycle ${review.cycleNumber} · ${review.status.replace(/_/g, " ")}`,
    href:
      review.status === "PENDING_CHAIR_APPROVAL"
        ? `/mentorship-program/chair/${review.id}`
        : `/mentorship-program/reviews/${review.selfReflectionId}`,
    sourceType: "MentorGoalReview",
    sourceId: review.id,
    chapterId: review.mentee.chapterId,
    subjectUserId: review.menteeId,
    dueAt:
      review.status === "PENDING_CHAIR_APPROVAL"
        ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        : null,
    allowedAdminSubtype: "MENTORSHIP_ADMIN",
    updatedById: review.chairReviewerId ?? review.mentorId,
  });
}

export async function syncCurriculumApprovalWorkflow(templateId: string) {
  const template = await prisma.classTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      title: true,
      submissionStatus: true,
      chapterId: true,
      createdById: true,
      reviewedById: true,
      submittedAt: true,
    },
  });

  if (!template || template.submissionStatus === "DRAFT") {
    return null;
  }

  const isComplete = template.submissionStatus === "APPROVED" || template.submissionStatus === "NEEDS_REVISION";
  return upsertWorkflowItem({
    kind: "CONTENT_APPROVAL",
    stage: isComplete ? "COMPLETE" : "FINAL_APPROVAL",
    status: workflowStatusFromTerminalState(isComplete),
    title: `${template.title} curriculum review`,
    summary: `Status: ${template.submissionStatus.replace(/_/g, " ")}`,
    href: `/admin/curricula#${template.id}`,
    sourceType: "ClassTemplate",
    sourceId: template.id,
    chapterId: template.chapterId,
    subjectUserId: template.createdById,
    dueAt:
      template.submissionStatus === "SUBMITTED"
        ? new Date((template.submittedAt ?? new Date()).getTime() + 3 * 24 * 60 * 60 * 1000)
        : null,
    allowedAssigneeRole: template.chapterId ? "CHAPTER_PRESIDENT" : null,
    allowedAdminSubtype: "CONTENT_ADMIN",
    updatedById: template.reviewedById ?? undefined,
  });
}
