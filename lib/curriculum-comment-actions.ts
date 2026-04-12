"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  CURRICULUM_COMMENT_ANCHOR_TYPES,
  type CurriculumCommentAnchorType,
  type CurriculumCommentRecord,
} from "@/app/(app)/instructor/lesson-design-studio/types";
import { getCurriculumDraftStudioRecord } from "@/lib/curriculum-draft-studio-access";

function revalidateCurriculumCommentSurfaces() {
  revalidatePath("/instructor/lesson-design-studio");
  revalidatePath("/admin/curricula");
  revalidatePath("/chapter-lead/instructor-readiness");
  revalidatePath("/admin/instructor-readiness");
}

function normalizeAnchorType(value: string): CurriculumCommentAnchorType {
  if (
    CURRICULUM_COMMENT_ANCHOR_TYPES.includes(
      value as CurriculumCommentAnchorType
    )
  ) {
    return value as CurriculumCommentAnchorType;
  }

  throw new Error("Invalid comment anchor");
}

function mapCommentRecord(comment: {
  id: string;
  draftId: string;
  authorId: string;
  parentId: string | null;
  anchorType: string;
  anchorId: string | null;
  anchorField: string | null;
  body: string;
  resolved: boolean;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null };
  resolvedBy: { id: string; name: string | null } | null;
}): CurriculumCommentRecord {
  return {
    id: comment.id,
    draftId: comment.draftId,
    authorId: comment.authorId,
    parentId: comment.parentId,
    anchorType: normalizeAnchorType(comment.anchorType),
    anchorId: comment.anchorId,
    anchorField: comment.anchorField,
    body: comment.body,
    resolved: comment.resolved,
    resolvedById: comment.resolvedById,
    resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: {
      id: comment.author.id,
      name: comment.author.name,
    },
    resolvedBy: comment.resolvedBy
      ? {
          id: comment.resolvedBy.id,
          name: comment.resolvedBy.name,
        }
      : null,
  };
}

export async function listComments(draftId: string) {
  const studioRecord = await getCurriculumDraftStudioRecord(draftId);
  if (!studioRecord || !studioRecord.access.canComment) {
    throw new Error("Draft not found or unauthorized");
  }

  const comments = await prisma.curriculumComment.findMany({
    where: { draftId },
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return comments.map(mapCommentRecord);
}

export async function createComment(input: {
  draftId: string;
  anchorType: CurriculumCommentAnchorType;
  anchorId?: string | null;
  anchorField?: string | null;
  body: string;
  parentId?: string | null;
}) {
  const studioRecord = await getCurriculumDraftStudioRecord(input.draftId);
  if (!studioRecord || !studioRecord.access.canComment) {
    throw new Error("Draft not found or unauthorized");
  }

  const body = input.body.trim();
  if (!body) {
    throw new Error("Comment body is required");
  }

  let anchorType = normalizeAnchorType(input.anchorType);
  let anchorId = input.anchorId ?? null;
  let anchorField = input.anchorField ?? null;
  let parentId = input.parentId ?? null;

  if (parentId) {
    const parent = await prisma.curriculumComment.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        draftId: true,
        anchorType: true,
        anchorId: true,
        anchorField: true,
      },
    });

    if (!parent || parent.draftId !== input.draftId) {
      throw new Error("Parent comment not found");
    }

    anchorType = normalizeAnchorType(parent.anchorType);
    anchorId = parent.anchorId;
    anchorField = parent.anchorField;
    parentId = parent.id;
  }

  const comment = await prisma.curriculumComment.create({
    data: {
      draftId: input.draftId,
      authorId: studioRecord.session.user.id,
      parentId,
      anchorType,
      anchorId,
      anchorField,
      body,
    },
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });

  revalidateCurriculumCommentSurfaces();
  return mapCommentRecord(comment);
}

export async function resolveComment(commentId: string, resolved = true) {
  const existing = await prisma.curriculumComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      draftId: true,
    },
  });

  if (!existing) {
    throw new Error("Comment not found");
  }

  const studioRecord = await getCurriculumDraftStudioRecord(existing.draftId);
  if (!studioRecord || !studioRecord.access.canResolveComments) {
    throw new Error("Only reviewers can resolve comments");
  }

  await prisma.curriculumComment.updateMany({
    where: {
      OR: [{ id: commentId }, { parentId: commentId }],
    },
    data: {
      resolved,
      resolvedById: resolved ? studioRecord.session.user.id : null,
      resolvedAt: resolved ? new Date() : null,
    },
  });

  revalidateCurriculumCommentSurfaces();
  return { success: true };
}

export async function deleteComment(commentId: string) {
  const existing = await prisma.curriculumComment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      draftId: true,
      authorId: true,
      parentId: true,
    },
  });

  if (!existing) {
    throw new Error("Comment not found");
  }

  const studioRecord = await getCurriculumDraftStudioRecord(existing.draftId);
  if (!studioRecord) {
    throw new Error("Draft not found or unauthorized");
  }

  const canDelete =
    existing.authorId === studioRecord.session.user.id ||
    studioRecord.access.canResolveComments;

  if (!canDelete) {
    throw new Error("You can only delete your own comments");
  }

  await prisma.$transaction(async (tx) => {
    await tx.curriculumComment.deleteMany({
      where: {
        OR: [{ id: commentId }, { parentId: commentId }],
      },
    });
  });

  revalidateCurriculumCommentSurfaces();
  return { success: true };
}
