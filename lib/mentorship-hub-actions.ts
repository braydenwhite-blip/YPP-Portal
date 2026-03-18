"use server";

import {
  MentorshipActionItemStatus,
  MentorshipRequestKind,
  MentorshipRequestStatus,
  MentorshipRequestVisibility,
  MentorshipProgramGroup,
  SupportRole,
} from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function canManageMentee(userId: string, roles: string[], menteeId: string) {
  const flags = getMentorshipRoleFlags(roles);
  if (flags.isAdmin || flags.isChapterLead || userId === menteeId) {
    return true;
  }

  const access = await prisma.mentorship.findFirst({
    where: {
      menteeId,
      status: "ACTIVE",
      OR: [
        { mentorId: userId },
        { chairId: userId },
        {
          circleMembers: {
            some: {
              userId,
              isActive: true,
            },
          },
        },
      ],
    },
    select: { id: true },
  });

  return Boolean(access);
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
  const userId = getString(formData, "userId");
  const role = getString(formData, "role") as SupportRole;
  const notes = getString(formData, "notes", false);

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
      where: { id: userId },
      select: { id: true },
    }),
    getActiveMentorshipContext(menteeId),
  ]);

  let mentorshipId = activeMentorship?.id ?? null;

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
      mentorId: userId,
      programGroup,
      governanceMode,
      excludeMentorshipId: activeMentorship?.id ?? null,
    });

    if (activeMentorship) {
      await prisma.mentorship.update({
        where: { id: activeMentorship.id },
        data: {
          mentorId: userId,
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
          mentorId: userId,
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
  }

  if (role === SupportRole.CHAIR && activeMentorship) {
    await prisma.mentorship.update({
      where: { id: activeMentorship.id },
      data: {
        chairId: userId,
      },
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
}

export async function createMentorshipSession(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const menteeId = getString(formData, "menteeId");

  if (!(await canManageMentee(userId, roles, menteeId))) {
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
  const participantIds = Array.from(
    new Set([
      menteeId,
      ...(activeMentorship?.circleMembers.map((member) => member.userId) ?? []),
    ])
  );

  await prisma.mentorshipSession.create({
    data: {
      mentorshipId: activeMentorship?.id ?? null,
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
  revalidatePath("/admin/mentorship-program");
}

export async function createMentorshipActionItem(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  const userId = session.user.id;
  const menteeId = getString(formData, "menteeId");

  if (!(await canManageMentee(userId, roles, menteeId))) {
    throw new Error("Unauthorized");
  }

  const title = getString(formData, "title");
  const details = getString(formData, "details", false);
  const ownerId = getString(formData, "ownerId", false);
  const sessionId = getString(formData, "sessionId", false);
  const dueAt = getOptionalDate(formData.get("dueAt"));
  const activeMentorship = await getActiveMentorshipContext(menteeId);

  await prisma.mentorshipActionItem.create({
    data: {
      mentorshipId: activeMentorship?.id ?? null,
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
    flags.isChapterLead ||
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
    (await canManageMentee(session.user.id, roles, request.menteeId));
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
  await requireAuth();

  await prisma.mentorshipRequestResponse.update({
    where: { id: responseId },
    data: {
      isHelpful: true,
      helpfulCount: { increment: 1 },
    },
  });

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
        },
      },
    },
  });

  if (!response) {
    throw new Error("Response not found");
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
