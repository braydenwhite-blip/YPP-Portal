"use server";

import { getSession } from "@/lib/auth-supabase";
import {
  MentorshipActionItemStatus,
  MentorshipRequestKind,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipProgramGroup,
  SupportRole,
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
    include: {
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

  revalidatePath("/admin/mentorship-program");
  revalidatePath("/admin/mentor-match");
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

  await prisma.mentorshipSession.create({
    data: {
      mentorshipId: activeMentorship.id,
      menteeId,
      type,
      title,
      scheduledAt,
      completedAt: completedNow ? scheduledAt : null,
      durationMinutes,
      agenda: agenda || null,
      notes: notes || null,
      participantIds,
      attendedIds: completedNow ? participantIds : [],
      createdById: userId,
      ledById: userId,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
  revalidatePath("/admin/mentorship-program");
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
  const activeMentorship = await getActiveMentorshipContext(menteeId);
  if (!activeMentorship) {
    throw new Error("Assign an active mentor before creating action items.");
  }

  const allowedOwnerIds = new Set([
    menteeId,
    ...activeMentorship.circleMembers.map((member) => member.userId),
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
      !linkedSession ||
      linkedSession.menteeId !== menteeId ||
      linkedSession.mentorshipId !== activeMentorship.id
    ) {
      throw new Error("Action items can only be attached to sessions for this mentee's active mentorship.");
    }
  }

  await prisma.mentorshipActionItem.create({
    data: {
      mentorshipId: activeMentorship.id,
      menteeId,
      sessionId: sessionId || null,
      title,
      details: details || null,
      ownerId: ownerId || null,
      createdById: userId,
      dueAt,
    },
  });

  revalidatePath("/mentorship");
  revalidatePath(`/mentorship/mentees/${menteeId}`);
  revalidatePath("/my-mentor");
  revalidatePath("/my-program");
}

export async function updateMentorshipActionItemStatus(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const itemId = getString(formData, "itemId");
  const status = getString(formData, "status") as MentorshipActionItemStatus;

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
  revalidatePath("/mentor/feedback");
  revalidatePath("/mentor/ask");
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

  revalidatePath("/mentor/feedback");
  revalidatePath("/mentor/ask");
  revalidatePath("/mentor/resources");
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

  revalidatePath("/mentor/feedback");
  revalidatePath("/mentor/ask");
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

  revalidatePath("/mentor/resources");
  revalidatePath("/mentor/ask");
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

  revalidatePath("/mentor/resources");
  revalidatePath("/mentorship");
}
