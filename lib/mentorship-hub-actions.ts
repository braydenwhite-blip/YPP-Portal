"use server";

import { getSession } from "@/lib/auth-supabase";
import {
  type ActionAssignmentRole,
  type ActionItemStatus,
  MentorshipActionItemStatus,
  MentorshipRequestKind,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipProgramGroup,
  MentorshipSessionType,
  SupportRole,
  MentorTag,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  ensureCanonicalTrack,
  enforceFullProgramMentorCapacity,
  getGovernanceModeForProgramGroup,
  getLegacyMenteeRoleTypeForRole,
  getMentorshipProgramGroupForRole,
  getMentorshipTypeForProgramGroup,
} from "@/lib/mentorship-canonical";
import {
  deriveMentorshipTypeFromRole,
  getMentorshipRoleFlags,
} from "@/lib/mentorship-hub";
import {
  getMentorshipAccessibleMenteeIds,
  hasMentorshipMenteeAccess,
} from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { syncActionSearchDocument } from "@/lib/help-agent/search-indexing";
import { startOfDay } from "@/lib/leadership-action-center/dates";
import { notifyNewActionAssignments } from "@/lib/people-strategy/action-emails";
import {
  canEditAction,
  type ActionAccessShape,
} from "@/lib/people-strategy/action-permissions";

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getOptionalDate(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") {
    return null;
  }
  return new Date(String(value));
}

function getOptionalInt(value: FormDataEntryValue | null) {
  if (!value || String(value).trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeRequest(details: string) {
  return details.length <= 80 ? details : `${details.slice(0, 79)}…`;
}

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function canManageMentee(userId: string, roles: string[], menteeId: string) {
  return hasMentorshipMenteeAccess(userId, roles, menteeId);
}

async function getAuthorizedMentorshipForNextStep(params: {
  mentorshipId: string;
  userId: string;
  roles: string[];
  allowMentee?: boolean;
}) {
  const { mentorshipId, userId, roles, allowMentee = false } = params;
  const flags = getMentorshipRoleFlags(roles);
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      chairId: true,
      status: true,
      circleMembers: {
        where: { isActive: true },
        select: { userId: true, role: true },
      },
    },
  });

  if (!mentorship) {
    throw new Error("Mentorship not found");
  }

  const isRelationshipMember =
    mentorship.mentorId === userId ||
    mentorship.chairId === userId ||
    mentorship.circleMembers.some((member) => member.userId === userId);
  const chapterLeadCanAccess =
    flags.isChapterLead &&
    (await hasMentorshipMenteeAccess(userId, roles, mentorship.menteeId));
  const menteeCanAct = allowMentee && mentorship.menteeId === userId;

  if (!flags.isAdmin && !isRelationshipMember && !chapterLeadCanAccess && !menteeCanAct) {
    throw new Error("Unauthorized");
  }

  if (!allowMentee && mentorship.menteeId === userId && !flags.isAdmin) {
    throw new Error("Unauthorized");
  }

  return mentorship;
}

function mentorshipActionStatusToActionStatus(
  status: MentorshipActionItemStatus
): ActionItemStatus {
  switch (status) {
    case MentorshipActionItemStatus.OPEN:
      return "NOT_STARTED";
    case MentorshipActionItemStatus.IN_PROGRESS:
      return "IN_PROGRESS";
    case MentorshipActionItemStatus.BLOCKED:
      return "BLOCKED";
    case MentorshipActionItemStatus.COMPLETE:
      return "COMPLETE";
    default:
      return "NOT_STARTED";
  }
}

function actionCompletedAtForStatus(
  previousStatus: ActionItemStatus,
  nextStatus: ActionItemStatus,
  now: Date
) {
  if (nextStatus === previousStatus) return undefined;
  if (nextStatus === "COMPLETE") return now;
  if (previousStatus === "COMPLETE") return null;
  return undefined;
}

function revalidateMentorshipNextStepSurfaces(menteeId: string) {
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
  revalidatePath("/actions");
}

async function canSupportMentee(userId: string, roles: string[], menteeId: string) {
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    return false;
  }

  if (flags.isAdmin) {
    return true;
  }

  const accessibleMenteeIds = await getMentorshipAccessibleMenteeIds(userId, roles);
  return accessibleMenteeIds == null || accessibleMenteeIds.includes(menteeId);
}

async function getActiveMentorshipContext(menteeId: string) {
  return prisma.mentorship.findFirst({
    where: {
      menteeId,
      status: "ACTIVE",
    },
    select: {
      ...MENTORSHIP_LEGACY_ROOT_SELECT,
      track: {
        select: { id: true, programGroup: true, governanceMode: true },
      },
      circleMembers: {
        where: { isActive: true },
        select: { userId: true, role: true },
      },
    },
  });
}

async function getLaunchedIntakePlanContext(menteeId: string) {
  return prisma.studentIntakeCase.findFirst({
    where: {
      studentUserId: menteeId,
      status: "MENTOR_PLAN_LAUNCHED",
    },
    select: {
      id: true,
      reviewOwnerId: true,
    },
    orderBy: { mentorPlanLaunchedAt: "desc" },
  });
}

type CreateMentorshipNextStepInput = {
  actorId: string;
  roles: string[];
  mentorshipId: string;
  title: string;
  details?: string | null;
  ownerId?: string | null;
  dueAt?: Date | null;
  sessionId?: string | null;
  sourceLegacyActionItemId?: string | null;
};

async function createMentorshipNextStepForUser(input: CreateMentorshipNextStepInput) {
  if (!isActionTrackerEnabled()) {
    throw new Error("Action Tracker is not enabled");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("Missing title");
  }

  const mentorship = await getAuthorizedMentorshipForNextStep({
    mentorshipId: input.mentorshipId,
    userId: input.actorId,
    roles: input.roles,
  });
  if (mentorship.status !== "ACTIVE") {
    throw new Error("Next steps can only be created for active mentorship relationships.");
  }

  const allowedOwnerIds = new Set([
    mentorship.menteeId,
    mentorship.mentorId,
    ...(mentorship.chairId ? [mentorship.chairId] : []),
    ...mentorship.circleMembers.map((member) => member.userId),
  ]);
  const ownerId = input.ownerId?.trim() || mentorship.menteeId;
  if (!allowedOwnerIds.has(ownerId)) {
    throw new Error("Owners must be the mentee, assigned mentor, chair, or an active support-circle member.");
  }

  const sessionId = input.sessionId?.trim() || null;
  if (sessionId) {
    const linkedSession = await prisma.mentorshipSession.findUnique({
      where: { id: sessionId },
      select: { id: true, menteeId: true, mentorshipId: true },
    });

    if (
      !linkedSession ||
      linkedSession.menteeId !== mentorship.menteeId ||
      linkedSession.mentorshipId !== mentorship.id
    ) {
      throw new Error("Next steps can only be attached to check-ins for this mentorship relationship.");
    }
  }

  const sourceId = input.sourceLegacyActionItemId ?? sessionId ?? mentorship.id;
  const existing = input.sourceLegacyActionItemId
    ? await prisma.actionItem.findFirst({
        where: {
          sourceType: "ENTITY",
          sourceId,
          relatedEntityType: "MENTORSHIP",
          relatedEntityId: mentorship.id,
          status: { not: "DROPPED" },
        },
        select: { id: true },
      })
    : await prisma.actionItem.findFirst({
        where: {
          relatedEntityType: "MENTORSHIP",
          relatedEntityId: mentorship.id,
          mentorshipSessionId: sessionId,
          title,
          leadId: ownerId,
          status: { not: "DROPPED" },
        },
        select: { id: true },
      });

  if (existing) {
    return { id: existing.id, created: false };
  }

  const deadlineStart = startOfDay(input.dueAt ?? new Date());
  const assignmentRows: Array<{ userId: string; role: ActionAssignmentRole }> = [
    { userId: ownerId, role: "LEAD" },
    { userId: ownerId, role: "EXECUTING" },
  ];

  const created = await prisma.$transaction(async (tx) => {
    const action = await tx.actionItem.create({
      data: {
        title,
        description: input.details?.trim() || null,
        actionType: "FOLLOW_UP",
        status: "NOT_STARTED",
        priority: "MEDIUM",
        deadlineStart,
        completedAt: null,
        visibility: "ALL_LEADERSHIP",
        leadId: ownerId,
        createdById: input.actorId,
        relatedEntityType: "MENTORSHIP",
        relatedEntityId: mentorship.id,
        sourceType: "ENTITY",
        sourceId,
        mentorshipSessionId: sessionId,
        assignments: {
          create: assignmentRows,
        },
        comments: {
          create: {
            authorId: input.actorId,
            type: "NOTE",
            body: "Mentorship next step created",
          },
        },
      },
      select: { id: true },
    });

    return action;
  });

  await notifyNewActionAssignments(created.id, assignmentRows);
  await syncActionSearchDocument(created.id);
  revalidateMentorshipNextStepSurfaces(mentorship.menteeId);
  return { id: created.id, created: true };
}

async function resolveSupportCircleChairId(params: {
  trackId?: string | null;
  primaryRole: string;
}) {
  const { trackId = null, primaryRole } = params;

  if (trackId) {
    const track = await prisma.mentorshipTrack.findUnique({
      where: { id: trackId },
      select: {
        committees: {
          where: {
            chairUserId: {
              not: null,
            },
          },
          orderBy: { createdAt: "asc" },
          select: { chairUserId: true },
        },
      },
    });

    const committeeChairId = track?.committees[0]?.chairUserId ?? null;
    if (committeeChairId) {
      return committeeChairId;
    }
  }

  const fallbackChair = await prisma.mentorCommitteeChair.findFirst({
    where: {
      roleType: getLegacyMenteeRoleTypeForRole(primaryRole),
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    select: { userId: true },
  });

  return fallbackChair?.userId ?? null;
}

async function upsertCircleMember(args: {
  mentorshipId?: string | null;
  menteeId: string;
  userId: string;
  role: SupportRole;
  source: string;
  notes?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}) {
  const {
    mentorshipId = null,
    menteeId,
    userId,
    role,
    source,
    notes = null,
    isPrimary = false,
    isActive = true,
  } = args;

  return prisma.mentorshipCircleMember.upsert({
    where: {
      menteeId_userId_role: {
        menteeId,
        userId,
        role,
      },
    },
    update: {
      mentorshipId,
      source,
      notes,
      isPrimary,
      isActive,
    },
    create: {
      mentorshipId,
      menteeId,
      userId,
      role,
      source,
      notes,
      isPrimary,
      isActive,
    },
  });
}

const EXCLUSIVE_SUPPORT_ROLES = new Set<SupportRole>([
  SupportRole.PRIMARY_MENTOR,
  SupportRole.CHAIR,
]);
const PRIMARY_MENTOR_ELIGIBLE_ROLES = new Set([
  "MENTOR",
  "INSTRUCTOR",
  "CHAPTER_PRESIDENT",
  "ADMIN",
  "STAFF",
]);
const CHAIR_ELIGIBLE_ROLES = new Set(["CHAPTER_PRESIDENT", "ADMIN"]);

function hasEligibleSupportRole(targetRoles: string[], allowedRoles: Set<string>) {
  return targetRoles.some((role) => allowedRoles.has(role));
}

async function deactivateExclusiveSupportRoleMembers(args: {
  mentorshipId?: string | null;
  menteeId: string;
  role: SupportRole;
  keepUserId: string;
}) {
  if (!EXCLUSIVE_SUPPORT_ROLES.has(args.role)) {
    return;
  }

  await prisma.mentorshipCircleMember.updateMany({
    where: {
      menteeId: args.menteeId,
      role: args.role,
      isActive: true,
      userId: {
        not: args.keepUserId,
      },
    },
    data: {
      mentorshipId: args.mentorshipId ?? null,
      isActive: false,
      isPrimary: false,
    },
  });
}

export async function ensureMentorshipSupportCircle(mentorshipId: string) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { id: mentorshipId },
    select: {
      id: true,
      mentorId: true,
      menteeId: true,
      chairId: true,
      status: true,
    },
  });

  if (!mentorship) {
    throw new Error("Mentorship not found");
  }

  await upsertCircleMember({
    mentorshipId: mentorship.id,
    menteeId: mentorship.menteeId,
    userId: mentorship.mentorId,
    role: SupportRole.PRIMARY_MENTOR,
    source: "MENTORSHIP_SYNC",
    isPrimary: true,
    isActive: mentorship.status === "ACTIVE",
  });

  if (mentorship.chairId) {
    await upsertCircleMember({
      mentorshipId: mentorship.id,
      menteeId: mentorship.menteeId,
      userId: mentorship.chairId,
      role: SupportRole.CHAIR,
      source: "MENTORSHIP_SYNC",
      isActive: mentorship.status === "ACTIVE",
    });
  }
}

export async function assignSupportCircleMember(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.isAdmin && !flags.isChapterLead) {
    throw new Error("Unauthorized");
  }

  const menteeId = getString(formData, "menteeId");
  const supporterId = getString(formData, "userId");
  const role = getString(formData, "role") as SupportRole;
  const notes = getString(formData, "notes", false);

  if (supporterId === menteeId) {
    throw new Error("A mentee cannot be assigned to their own support circle.");
  }

  if (!(await hasMentorshipMenteeAccess(session.user.id, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const [mentee, targetUser, activeMentorship] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: menteeId },
      select: {
        id: true,
        primaryRole: true,
        chapterId: true,
        chapter: { select: { name: true } },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: supporterId },
      select: {
        id: true,
        primaryRole: true,
        roles: {
          select: { role: true },
        },
      },
    }),
    getActiveMentorshipContext(menteeId),
  ]);

  let mentorshipId = activeMentorship?.id ?? null;

  if (role !== SupportRole.PRIMARY_MENTOR && !activeMentorship) {
    throw new Error("Assign a primary mentor before adding other support roles.");
  }

  const targetRoles = Array.from(
    new Set([targetUser.primaryRole, ...targetUser.roles.map((entry) => entry.role)])
  );

  if (
    role === SupportRole.PRIMARY_MENTOR &&
    !hasEligibleSupportRole(targetRoles, PRIMARY_MENTOR_ELIGIBLE_ROLES)
  ) {
    throw new Error("Primary mentors must have an active mentor or instructor support role.");
  }

  if (role === SupportRole.CHAIR && !hasEligibleSupportRole(targetRoles, CHAIR_ELIGIBLE_ROLES)) {
    throw new Error("Chairs must be chapter presidents or admins.");
  }

  if (role === SupportRole.PRIMARY_MENTOR) {
    const programGroup = getMentorshipProgramGroupForRole(mentee.primaryRole);
    const governanceMode = getGovernanceModeForProgramGroup(programGroup);
    const scopedChapterId =
      programGroup === MentorshipProgramGroup.INSTRUCTOR ||
      programGroup === MentorshipProgramGroup.STUDENT
        ? mentee.chapterId
        : null;
    const track =
      activeMentorship?.trackId != null
        ? await prisma.mentorshipTrack.findUniqueOrThrow({
            where: { id: activeMentorship.trackId },
          })
        : await ensureCanonicalTrack({
            group: programGroup,
            chapterId: scopedChapterId,
            chapterName: mentee.chapter?.name ?? null,
          });
    const resolvedChairId = await resolveSupportCircleChairId({
      trackId: track.id,
      primaryRole: mentee.primaryRole,
    });

    await enforceFullProgramMentorCapacity({
      mentorId: supporterId,
      programGroup,
      governanceMode,
      excludeMentorshipId: activeMentorship?.id ?? null,
    });

    if (activeMentorship) {
      await prisma.mentorship.update({
        where: { id: activeMentorship.id },
        data: {
          mentorId: supporterId,
          type: getMentorshipTypeForProgramGroup(programGroup),
          programGroup,
          governanceMode,
          trackId: track.id,
          chairId: activeMentorship.chairId ?? resolvedChairId,
        },
      });
      mentorshipId = activeMentorship.id;
    } else {
      const mentorship = await prisma.mentorship.create({
        data: {
          mentorId: supporterId,
          menteeId,
          type: getMentorshipTypeForProgramGroup(programGroup),
          programGroup,
          governanceMode,
          trackId: track.id,
          chairId: resolvedChairId,
          notes: notes || "Created from support circle assignment",
        },
      });
      mentorshipId = mentorship.id;
    }

    await deactivateExclusiveSupportRoleMembers({
      mentorshipId,
      menteeId,
      role: SupportRole.PRIMARY_MENTOR,
      keepUserId: targetUser.id,
    });
  }

  if (role === SupportRole.CHAIR && activeMentorship) {
    await prisma.mentorship.update({
      where: { id: activeMentorship.id },
      data: {
        chairId: supporterId,
      },
    });

    mentorshipId = activeMentorship.id;
    await deactivateExclusiveSupportRoleMembers({
      mentorshipId,
      menteeId,
      role: SupportRole.CHAIR,
      keepUserId: targetUser.id,
    });
  }

  await upsertCircleMember({
    mentorshipId,
    menteeId,
    userId: targetUser.id,
    role,
    source: "MANUAL_ASSIGNMENT",
    notes: notes || null,
    isPrimary: role === SupportRole.PRIMARY_MENTOR,
    isActive: true,
  });

  if (mentorshipId) {
    await ensureMentorshipSupportCircle(mentorshipId);
  }

  revalidatePath("/admin/mentorship");
  revalidatePath("/admin/mentorship");
  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
}

export async function createMentorshipSession(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const menteeId = getString(formData, "menteeId");

  if (!(await canSupportMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const type = getString(formData, "type") as any;
  const title = getString(formData, "title", false) || `${type.replace(/_/g, " ")} session`;
  const scheduledAt = getOptionalDate(formData.get("scheduledAt"));
  if (!scheduledAt) {
    throw new Error("Missing scheduledAt");
  }

  const agenda = getString(formData, "agenda", false);
  const notes = getString(formData, "notes", false);
  const meetingLink = getString(formData, "meetingLink", false);
  const schedulingOverrideReason = getString(formData, "schedulingOverrideReason", false);
  const durationMinutes = getOptionalInt(formData.get("durationMinutes"));
  const completedNow = getString(formData, "completedNow", false) === "true";

  const activeMentorship = await getActiveMentorshipContext(menteeId);
  if (!activeMentorship) {
    throw new Error("Assign an active mentor before logging sessions.");
  }
  const participantIds = Array.from(
    new Set([
      menteeId,
      ...activeMentorship.circleMembers.map((member) => member.userId),
    ])
  );
  const completedAt = completedNow ? scheduledAt : null;

  await prisma.mentorshipSession.create({
    data: {
      mentorshipId: activeMentorship.id,
      menteeId,
      type,
      title,
      scheduledAt,
      completedAt,
      durationMinutes,
      agenda: agenda || null,
      notes: notes || null,
      meetingLink: meetingLink || null,
      schedulingOverrideReason: schedulingOverrideReason || null,
      participantIds,
      attendedIds: completedNow ? participantIds : [],
      createdById: userId,
      ledById: userId,
    },
  });

  if (type === MentorshipSessionType.KICKOFF) {
    const kickoffUpdate: {
      kickoffScheduledAt?: Date;
      kickoffCompletedAt?: Date;
    } = {};

    if (
      !activeMentorship.kickoffScheduledAt ||
      scheduledAt < activeMentorship.kickoffScheduledAt
    ) {
      kickoffUpdate.kickoffScheduledAt = scheduledAt;
    }

    if (completedAt && !activeMentorship.kickoffCompletedAt) {
      kickoffUpdate.kickoffCompletedAt = completedAt;
    }

    if (Object.keys(kickoffUpdate).length > 0) {
      await prisma.mentorship.update({
        where: { id: activeMentorship.id },
        data: kickoffUpdate,
      });
    }
  }

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
  revalidatePath("/admin/mentorship");
}

/**
 * Live capture (Calm Mentorship, Phase 5) — save an in-progress session's
 * agenda, running notes, and attendance without completing it. Writes only to
 * existing `MentorshipSession` fields; attendance is additive so re-saving never
 * drops someone already marked present. Notes stay private (mentor / circle).
 */
export async function recordMentorshipSessionCapture(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const sessionId = getString(formData, "sessionId");
  const menteeId = getString(formData, "menteeId");

  if (!(await canSupportMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.mentorshipSession.findUnique({
    where: { id: sessionId },
    select: { id: true, menteeId: true, attendedIds: true },
  });
  if (!existing || existing.menteeId !== menteeId) {
    throw new Error("Session not found for this mentee.");
  }

  const agenda = getString(formData, "agenda", false);
  const notes = getString(formData, "notes", false);
  const menteeAttended = getString(formData, "menteeAttended", false) === "true";

  const attended = new Set(existing.attendedIds);
  if (menteeAttended) {
    attended.add(menteeId);
    attended.add(userId);
  } else {
    attended.delete(menteeId);
  }

  await prisma.mentorshipSession.update({
    where: { id: sessionId },
    data: {
      agenda: agenda || null,
      notes: notes || null,
      attendedIds: Array.from(attended),
    },
  });

  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/mentorship");
}

/**
 * Session completion — close a mentorship-owned check-in and optionally create
 * one canonical Action Tracker next step with source-session provenance.
 * Idempotent: a repeat submit won't re-stamp completion or duplicate the next
 * step. The mentee never sees the private recap — only the completed check-in
 * and any assigned next step.
 */
export async function completeMentorshipSession(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const sessionId = getString(formData, "sessionId");
  const menteeId = getString(formData, "menteeId");

  if (!(await canSupportMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.mentorshipSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      menteeId: true,
      mentorshipId: true,
      type: true,
      completedAt: true,
      attendedIds: true,
    },
  });
  if (!existing || existing.menteeId !== menteeId) {
    throw new Error("Session not found for this mentee.");
  }

  const recap = getString(formData, "notes", false);
  const menteeAttended = getString(formData, "menteeAttended", false) === "true";
  const commitmentTitle = getString(formData, "commitmentTitle", false);
  const commitmentOwner = getString(formData, "commitmentOwnerId", false);

  const completedAt = existing.completedAt ?? new Date();
  const attended = new Set(existing.attendedIds);
  if (menteeAttended) {
    attended.add(menteeId);
    attended.add(userId);
  }

  await prisma.mentorshipSession.update({
    where: { id: sessionId },
    data: {
      completedAt,
      attendedIds: Array.from(attended),
      ledById: userId,
      ...(recap ? { notes: recap } : {}),
    },
  });

  // Turn the session into at most one canonical next step. The helper checks
  // duplicate (relationship + session + title + owner) before writing.
  if (commitmentTitle && existing.mentorshipId) {
    const ownerId =
      commitmentOwner === menteeId || commitmentOwner === userId ? commitmentOwner : menteeId;
    await createMentorshipNextStepForUser({
      actorId: userId,
      roles,
      mentorshipId: existing.mentorshipId,
      title: commitmentTitle,
      ownerId,
      sessionId,
    });
  }

  // Kickoff completion side-effect (parity with createMentorshipSession).
  if (existing.type === MentorshipSessionType.KICKOFF && existing.mentorshipId) {
    await prisma.mentorship.updateMany({
      where: { id: existing.mentorshipId, kickoffCompletedAt: null },
      data: { kickoffCompletedAt: completedAt },
    });
  }

  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/mentorship");
  revalidatePath("/my-mentor");
}

/**
 * LEGACY / PRE-ASSIGNMENT ONLY — the one remaining `MentorshipActionItem` write.
 *
 * Intake action plans are launched before a mentor is matched, so there is no
 * `Mentorship` to scope a canonical relationship `ActionItem` to. Until
 * pre-assignment intake gets a canonical home, this writes an unattached legacy
 * row (`mentorshipId: null`).
 *
 * Invariants (do not weaken):
 *  - It is NEVER called for an active relationship — `createMentorshipActionItem`
 *    routes those to `createMentorshipNextStepForUser` (canonical) and returns
 *    before reaching here. So a normal relationship never maintains two action
 *    records.
 *  - `mentorshipId` is hard-coded null (not a parameter), so this can never
 *    masquerade as a relationship next step or be double-counted next to a
 *    canonical twin (the canonical merge only keeps unlinked legacy rows).
 *
 * Deletion condition: remove once pre-assignment intake plans create canonical
 * `ActionItem`s (or are migrated to one), the operator backfill has run, and no
 * `MentorshipActionItem` rows with `mentorshipId = null` remain unmigrated.
 */
async function createPreAssignmentIntakeActionItem(input: {
  menteeId: string;
  sessionId: string | null;
  title: string;
  details: string | null;
  ownerId: string | null;
  createdById: string;
  dueAt: Date | null;
}) {
  await prisma.mentorshipActionItem.create({
    data: {
      mentorshipId: null, // pre-assignment: no relationship exists yet
      menteeId: input.menteeId,
      sessionId: input.sessionId,
      title: input.title,
      details: input.details,
      ownerId: input.ownerId,
      createdById: input.createdById,
      dueAt: input.dueAt,
    },
  });
}

export async function createMentorshipActionItem(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const menteeId = getString(formData, "menteeId");

  if (!(await canSupportMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const title = getString(formData, "title");
  const details = getString(formData, "details", false);
  const ownerId = getString(formData, "ownerId", false);
  const sessionId = getString(formData, "sessionId", false);
  const dueAt = getOptionalDate(formData.get("dueAt"));
  const [activeMentorship, launchedIntakePlan] = await Promise.all([
    getActiveMentorshipContext(menteeId),
    getLaunchedIntakePlanContext(menteeId),
  ]);
  if (!activeMentorship && !launchedIntakePlan) {
    throw new Error("Assign an active mentor or launch an intake action plan before creating action items.");
  }

  const allowedOwnerIds = new Set([
    menteeId,
    ...(activeMentorship?.circleMembers.map((member) => member.userId) ?? []),
  ]);
  if (ownerId && !allowedOwnerIds.has(ownerId)) {
    throw new Error("Owners must be the mentee or an active support-circle member.");
  }

  if (sessionId) {
    const linkedSession = await prisma.mentorshipSession.findUnique({
      where: { id: sessionId },
      select: { id: true, menteeId: true, mentorshipId: true },
    });

    if (
      !activeMentorship ||
      !linkedSession ||
      linkedSession.menteeId !== menteeId ||
      linkedSession.mentorshipId !== activeMentorship.id
    ) {
      throw new Error("Action items can only be attached to sessions for this mentee's active mentorship.");
    }
  }

  if (activeMentorship) {
    // Active relationship → ALWAYS a canonical ActionItem, never a
    // MentorshipActionItem. This early return is what guarantees the legacy
    // write below can never run for a real relationship.
    await createMentorshipNextStepForUser({
      actorId: userId,
      roles,
      mentorshipId: activeMentorship.id,
      title,
      details: details || null,
      ownerId: ownerId || null,
      dueAt,
      sessionId: sessionId || null,
    });
    return;
  }

  // Pre-assignment exception only (no Mentorship exists yet — see helper).
  await createPreAssignmentIntakeActionItem({
    menteeId,
    sessionId: sessionId || null,
    title,
    details: details || null,
    ownerId: ownerId || null,
    createdById: userId,
    dueAt,
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
}

export async function createMentorshipNextStep(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const mentorshipId = getString(formData, "mentorshipId");
  const title = getString(formData, "title");
  const details = getString(formData, "details", false);
  const ownerId = getString(formData, "ownerId", false);
  const sessionId = getString(formData, "sessionId", false);
  const dueAt = getOptionalDate(formData.get("dueAt"));

  return createMentorshipNextStepForUser({
    actorId: session.user.id,
    roles,
    mentorshipId,
    title,
    details: details || null,
    ownerId: ownerId || null,
    dueAt,
    sessionId: sessionId || null,
  });
}

export async function updateMentorshipActionItemStatus(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const itemId = getString(formData, "itemId");
  const status = getString(formData, "status") as MentorshipActionItemStatus;

  const canonical = await prisma.actionItem.findFirst({
    where: {
      id: itemId,
      relatedEntityType: "MENTORSHIP",
      relatedEntityId: { not: null },
    },
    select: {
      id: true,
      leadId: true,
      createdById: true,
      visibility: true,
      status: true,
      relatedEntityId: true,
      assignments: { select: { userId: true, role: true } },
    },
  });

  if (canonical?.relatedEntityId) {
    const viewer = {
      id: userId,
      roles,
      primaryRole: session.user.primaryRole ?? null,
      adminSubtypes: session.user.adminSubtypes ?? [],
    };
    const access: ActionAccessShape = {
      leadId: canonical.leadId,
      createdById: canonical.createdById,
      visibility: canonical.visibility,
      assignments: canonical.assignments,
    };
    let canUpdate = canEditAction(viewer, access);
    let menteeIdForRevalidation: string | null = null;

    if (!canUpdate) {
      const mentorship = await getAuthorizedMentorshipForNextStep({
        mentorshipId: canonical.relatedEntityId,
        userId,
        roles,
        allowMentee: true,
      });
      menteeIdForRevalidation = mentorship.menteeId;
      canUpdate = mentorship.menteeId !== userId;
    }

    if (!canUpdate) {
      throw new Error("Unauthorized");
    }

    const nextStatus = mentorshipActionStatusToActionStatus(status);
    const completedAt = actionCompletedAtForStatus(canonical.status, nextStatus, new Date());
    await prisma.$transaction(async (tx) => {
      await tx.actionItem.update({
        where: { id: canonical.id },
        data: {
          status: nextStatus,
          ...(completedAt !== undefined ? { completedAt } : {}),
        },
      });
      await tx.actionComment.create({
        data: {
          actionItemId: canonical.id,
          authorId: userId,
          type: "NOTE",
          body: `Mentorship next step status changed from ${canonical.status} to ${nextStatus}`,
        },
      });
    });

    await syncActionSearchDocument(canonical.id);
    if (!menteeIdForRevalidation) {
      const mentorship = await prisma.mentorship.findUnique({
        where: { id: canonical.relatedEntityId },
        select: { menteeId: true },
      });
      menteeIdForRevalidation = mentorship?.menteeId ?? null;
    }
    if (menteeIdForRevalidation) {
      revalidateMentorshipNextStepSurfaces(menteeIdForRevalidation);
    } else {
      revalidatePath("/mentorship");
      revalidatePath("/my-mentor");
      revalidatePath("/actions");
    }
    return;
  }

  const item = await prisma.mentorshipActionItem.findUnique({
    where: { id: itemId },
    select: { id: true, menteeId: true, ownerId: true },
  });

  if (!item) {
    throw new Error("Action item not found");
  }

  const flags = getMentorshipRoleFlags(roles);
  const canUpdate =
    flags.isAdmin ||
    item.ownerId === userId ||
    item.menteeId === userId ||
    (await canManageMentee(userId, roles, item.menteeId));

  if (!canUpdate) {
    throw new Error("Unauthorized");
  }

  await prisma.mentorshipActionItem.update({
    where: { id: itemId },
    data: {
      status,
      completedAt: status === MentorshipActionItemStatus.COMPLETE ? new Date() : null,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${item.menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
}

export async function createMentorshipRequest(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const menteeId = getString(formData, "menteeId", false) || userId;

  if (!(await canManageMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const kind =
    (getString(formData, "kind", false) as MentorshipRequestKind) ||
    MentorshipRequestKind.PROJECT_FEEDBACK;
  const visibility =
    (getString(formData, "visibility", false) as MentorshipRequestVisibility) ||
    MentorshipRequestVisibility.PRIVATE;
  const details =
    getString(formData, "details", false) || getString(formData, "question");
  const title = getString(formData, "title", false) || summarizeRequest(details);
  const passionId = getString(formData, "passionId", false);
  const projectId = getString(formData, "projectId", false);
  const isAnonymous =
    getString(formData, "isAnonymous", false) === "true" || formData.get("isAnonymous") === "on";
  const activeMentorship = await getActiveMentorshipContext(menteeId);

  const assignedToId =
    getString(formData, "assignedToId", false) ||
    (visibility === MentorshipRequestVisibility.PRIVATE
      ? activeMentorship?.circleMembers.find((member) => member.role === SupportRole.PRIMARY_MENTOR)
          ?.userId ?? null
      : null);

  const request = await prisma.mentorshipRequest.create({
    data: {
      mentorshipId: activeMentorship?.id ?? null,
      menteeId,
      requesterId: userId,
      assignedToId,
      trackId: activeMentorship?.track?.id ?? null,
      kind,
      visibility,
      title,
      details,
      isAnonymous,
      passionId: passionId || null,
      projectId: projectId || null,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath("/mentorship/feedback");
  revalidatePath("/mentorship/ask");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");

  return request;
}

export async function respondToMentorshipRequest(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    throw new Error("Unauthorized");
  }

  const requestId = getString(formData, "requestId");
  const body =
    getString(formData, "body", false) || getString(formData, "feedback", false) || getString(formData, "answer");
  const resourceUrl = getString(formData, "resourceUrl", false);

  const request = await prisma.mentorshipRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      mentorshipId: true,
      menteeId: true,
      trackId: true,
      visibility: true,
      assignedToId: true,
    },
  });

  if (!request) {
    throw new Error("Request not found");
  }

  const canReply =
    flags.isAdmin ||
    request.assignedToId === session.user.id ||
    (request.visibility === MentorshipRequestVisibility.PUBLIC
      ? flags.canSupport
      : await canSupportMentee(session.user.id, roles, request.menteeId));
  if (!canReply) {
    throw new Error("Unauthorized");
  }

  const response = await prisma.mentorshipRequestResponse.create({
    data: {
      requestId,
      responderId: session.user.id,
      body,
      resourceLinks: resourceUrl ? [resourceUrl] : [],
    },
  });

  await prisma.mentorshipRequest.update({
    where: { id: requestId },
    data: {
      status: MentorshipRequestStatus.ANSWERED,
      lastResponseAt: response.createdAt,
    },
  });

  if (resourceUrl) {
    await prisma.mentorshipResource.create({
      data: {
        mentorshipId: request.mentorshipId ?? null,
        menteeId: request.visibility === MentorshipRequestVisibility.PRIVATE ? request.menteeId : null,
        requestId,
        responseId: response.id,
        trackId: request.trackId ?? null,
        createdById: session.user.id,
        type: "LINK",
        title: "Shared support resource",
        description:
          request.visibility === MentorshipRequestVisibility.PRIVATE
            ? "Attached from a private mentorship response."
            : "Shared from a public mentorship response.",
        url: resourceUrl,
        isPublished: request.visibility === MentorshipRequestVisibility.PUBLIC,
      },
    });
  }

  revalidatePath("/mentorship/feedback");
  revalidatePath("/mentorship/ask");
  revalidatePath("/mentorship/resources");
  revalidatePath(`/mentorship/mentees/${request.menteeId}`);
  revalidatePath("/mentorship");
}

export async function markMentorshipResponseHelpful(responseId: string) {
  const session = await requireAuth();

  const response = await prisma.mentorshipRequestResponse.findUnique({
    where: { id: responseId },
    select: {
      id: true,
      responderId: true,
      isHelpful: true,
      helpfulCount: true,
      request: {
        select: {
          visibility: true,
          menteeId: true,
          requesterId: true,
        },
      },
    },
  });
  if (!response) {
    throw new Error("Response not found");
  }

  if (response.request.visibility === MentorshipRequestVisibility.PRIVATE) {
    const canMarkPrivateFeedbackHelpful =
      session.user.id === response.request.menteeId ||
      session.user.id === response.request.requesterId;
    if (!canMarkPrivateFeedbackHelpful) {
      throw new Error("Unauthorized");
    }
    if (response.isHelpful) {
      return;
    }

    await prisma.mentorshipRequestResponse.update({
      where: { id: responseId },
      data: {
        isHelpful: true,
        helpfulCount: response.helpfulCount + 1,
      },
    });
  } else {
    if (response.responderId === session.user.id) {
      throw new Error("You cannot upvote your own answer.");
    }

    await prisma.mentorshipRequestResponse.update({
      where: { id: responseId },
      data: {
        helpfulCount: { increment: 1 },
      },
    });
  }

  revalidatePath("/mentorship/feedback");
  revalidatePath("/mentorship/ask");
}

export async function promoteMentorshipResponseToResource(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    throw new Error("Unauthorized");
  }

  const responseId = getString(formData, "responseId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const type = getString(formData, "type", false) || "ANSWER";

  const response = await prisma.mentorshipRequestResponse.findUnique({
    where: { id: responseId },
    include: {
      request: {
        select: {
          id: true,
          mentorshipId: true,
          menteeId: true,
          trackId: true,
          passionId: true,
          visibility: true,
        },
      },
    },
  });

  if (!response) {
    throw new Error("Response not found");
  }

  if (response.request.visibility !== MentorshipRequestVisibility.PUBLIC) {
    throw new Error("Only public mentorship answers can be promoted into shared resources.");
  }

  if (!flags.isAdmin && response.responderId !== session.user.id) {
    throw new Error("Only the responder or an admin can publish this answer.");
  }

  await prisma.mentorshipResource.create({
    data: {
      mentorshipId: response.request.mentorshipId ?? null,
      menteeId: null,
      requestId: response.request.id,
      responseId,
      trackId: response.request.trackId ?? null,
      createdById: session.user.id,
      type: type as any,
      title,
      description: description || null,
      body: response.body,
      passionId: response.request.passionId ?? null,
      isFeatured: true,
      isPublished: true,
    },
  });

  revalidatePath("/mentorship/resources");
  revalidatePath("/mentorship/ask");
  revalidatePath("/mentorship");
}

export async function createMentorshipResource(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    throw new Error("Unauthorized");
  }

  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const type = getString(formData, "type", false) || "LINK";
  const url = getString(formData, "url", false);
  const body = getString(formData, "body", false);
  const passionId = getString(formData, "passionId", false);
  const isFeatured = getString(formData, "isFeatured", false) === "true";

  await prisma.mentorshipResource.create({
    data: {
      createdById: session.user.id,
      type: type as any,
      title,
      description: description || null,
      url: url || null,
      body: body || null,
      passionId: passionId || null,
      isFeatured,
      isPublished: true,
    },
  });

  revalidatePath("/mentorship/resources");
  revalidatePath("/mentorship");
}

export async function markKickoffComplete(
  mentorshipId: string,
  notes?: string
) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    throw new Error("Unauthorized");
  }

  // Only the mentor or chair on this pairing (or admin) may mark kickoff
  // complete. Without this check any role with canSupport could close out
  // any pairing's kickoff and advance its cycle stage.
  if (!flags.isAdmin) {
    const pairing = await prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: { mentorId: true, chairId: true },
    });
    if (!pairing) {
      throw new Error("Mentorship not found");
    }
    if (pairing.mentorId !== session.user.id && pairing.chairId !== session.user.id) {
      throw new Error("Unauthorized");
    }
  }

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: {
      kickoffCompletedAt: new Date(),
      kickoffNotes: notes ?? null,
      cycleStage: "REFLECTION_DUE",
    },
  });

  revalidatePath("/mentorship");
}

export async function setMentorTag(
  mentorshipId: string,
  tag: MentorTag | null
) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  if (!flags.canSupport) {
    throw new Error("Unauthorized");
  }

  // Tighten: only the mentor on this pairing (or admin) may tag it. Without
  // this check any role with canSupport could mutate any pairing's tag.
  if (!flags.isAdmin) {
    const pairing = await prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: { mentorId: true, chairId: true },
    });
    if (!pairing) {
      throw new Error("Mentorship not found");
    }
    if (pairing.mentorId !== session.user.id && pairing.chairId !== session.user.id) {
      throw new Error("Unauthorized");
    }
  }

  await prisma.mentorship.update({
    where: { id: mentorshipId },
    data: { mentorTag: tag },
  });

  revalidatePath("/mentorship");
}
