"use server";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  canAccessCurriculumDraftForStudio,
  canCommentOnCurriculumDraft,
  canEditCurriculumDraftInStudio,
  canResolveCurriculumDraftComments,
} from "@/lib/curriculum-draft-access";
import type { StudioViewerAccess } from "@/app/(app)/instructor/lesson-design-studio/types";

async function requireStudioSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const roles = session.user.roles ?? [];
  const allowed =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_PRESIDENT") ||
    roles.includes("APPLICANT");

  if (!allowed) {
    throw new Error("Studio access requires Instructor or Applicant role");
  }

  return session;
}

async function getRequesterChapterId(requesterId: string, roles: string[]) {
  if (!roles.includes("CHAPTER_PRESIDENT")) {
    return null;
  }

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { chapterId: true },
  });

  return requester?.chapterId ?? null;
}

export async function getCurriculumDraftStudioRecord(draftId: string) {
  const session = await requireStudioSession();
  const roles = session.user.roles ?? [];
  const requesterChapterId = await getRequesterChapterId(session.user.id, roles);

  const draft = await prisma.curriculumDraft.findUnique({
    where: { id: draftId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          chapterId: true,
        },
      },
    },
  });

  if (!draft) {
    return null;
  }

  const accessInput = {
    requesterId: session.user.id,
    requesterRoles: roles,
    requesterChapterId,
    authorId: draft.authorId,
    authorChapterId: draft.author.chapterId,
    draftStatus: draft.status,
  };

  if (!canAccessCurriculumDraftForStudio(accessInput)) {
    return null;
  }

  const access: StudioViewerAccess = {
    canView: true,
    canEdit: canEditCurriculumDraftInStudio(accessInput),
    canComment: canCommentOnCurriculumDraft(accessInput),
    canResolveComments: canResolveCurriculumDraftComments(accessInput),
    viewerKind: session.user.id === draft.authorId ? "AUTHOR" : "REVIEWER",
  };

  return {
    session,
    draft,
    access,
    requesterChapterId,
  };
}
