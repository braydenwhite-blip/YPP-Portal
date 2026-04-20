"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { ApplicantDocumentKind, Prisma } from "@prisma/client";
import { getHiringActor, assertCanViewApplicant, type ApplicationContext } from "@/lib/chapter-hiring-permissions";
import { trackApplicantEvent } from "@/lib/telemetry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

/** Fetch the application context needed for permission checks. */
async function getApplicationContext(applicationId: string): Promise<ApplicationContext> {
  const app = await prisma.instructorApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      applicantId: true,
      reviewerId: true,
      applicant: { select: { chapterId: true } },
      interviewerAssignments: {
        where: { removedAt: null },
        select: { interviewerId: true, removedAt: true },
      },
    },
  });
  if (!app) throw new Error("Application not found");
  return {
    id: app.id,
    applicantId: app.applicantId,
    reviewerId: app.reviewerId,
    applicantChapterId: app.applicant.chapterId,
    interviewerAssignments: app.interviewerAssignments,
  };
}

/**
 * Recompute and persist `materialsReadyAt` on an InstructorApplication.
 * Set when both COURSE_OUTLINE and FIRST_CLASS_PLAN have a non-superseded document.
 * Must be called inside a Prisma transaction (pass `tx`) or standalone.
 */
async function recomputeMaterialsReadyAt(
  applicationId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
  const db = tx ?? prisma;

  const requiredKinds: ApplicantDocumentKind[] = [
    ApplicantDocumentKind.COURSE_OUTLINE,
    ApplicantDocumentKind.FIRST_CLASS_PLAN,
  ];

  const presentKinds = await (db as typeof prisma).applicantDocument.findMany({
    where: {
      applicationId,
      kind: { in: requiredKinds },
      supersededAt: null,
    },
    select: { kind: true },
  });

  const hasAll = requiredKinds.every((k) => presentKinds.some((d) => d.kind === k));

  await (db as typeof prisma).instructorApplication.update({
    where: { id: applicationId },
    data: { materialsReadyAt: hasAll ? new Date() : null },
  });
}

/** Write a timeline event. */
async function writeTimelineEvent(
  applicationId: string,
  kind: string,
  actorId: string | null,
  payload: Record<string, unknown>,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
  const db = tx ?? prisma;
  await (db as typeof prisma).instructorApplicationTimelineEvent.create({
    data: { applicationId, kind, actorId, payload: payload as Prisma.InputJsonValue },
  });
}

// ─── Upload applicant document ────────────────────────────────────────────────

/**
 * Create an ApplicantDocument record after the file has been uploaded via /api/upload.
 * Supersedes any prior document of the same kind, then recomputes materialsReadyAt.
 *
 * Expected formData fields:
 *   applicationId, kind (ApplicantDocumentKind), fileUrl, originalName?, fileSize?, note?
 */
export async function uploadApplicantDocument(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const applicationId = getString(formData, "applicationId");
    const kindRaw = getString(formData, "kind");
    const fileUrl = getString(formData, "fileUrl");
    const originalName = getString(formData, "originalName", false) || null;
    const fileSizeRaw = formData.get("fileSize");
    const fileSize = fileSizeRaw ? Number(fileSizeRaw) : null;
    const note = getString(formData, "note", false) || null;

    if (!Object.values(ApplicantDocumentKind).includes(kindRaw as ApplicantDocumentKind)) {
      return { success: false, error: "Invalid document kind." };
    }
    const kind = kindRaw as ApplicantDocumentKind;

    const appCtx = await getApplicationContext(applicationId);
    const actor = await getHiringActor(session.user.id);

    // Applicant can upload their own docs; chapter leads and admins can upload on behalf.
    const isApplicant = actor.id === appCtx.applicantId;
    const isPrivileged =
      actor.roles.includes("ADMIN") ||
      (actor.roles.includes("CHAPTER_PRESIDENT") &&
        actor.chapterId === appCtx.applicantChapterId);
    if (!isApplicant && !isPrivileged) {
      return { success: false, error: "Unauthorized: you cannot upload documents for this application." };
    }

    await prisma.$transaction(async (tx) => {
      // Supersede prior documents of the same kind
      await tx.applicantDocument.updateMany({
        where: { applicationId, kind, supersededAt: null },
        data: { supersededAt: new Date() },
      });

      await tx.applicantDocument.create({
        data: {
          applicationId,
          kind,
          fileUrl,
          originalName,
          fileSize,
          note,
          uploadedById: actor.id,
        },
      });

      await recomputeMaterialsReadyAt(applicationId, tx);
      await writeTimelineEvent(
        applicationId,
        "DOC_UPLOADED",
        actor.id,
        { kind, originalName, fileUrl },
        tx
      );
    });

    // Emit telemetry when both required docs are now present (materialsReadyAt just stamped).
    const refreshed = await prisma.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { materialsReadyAt: true, status: true, applicant: { select: { chapterId: true } } },
    });
    if (refreshed?.materialsReadyAt) {
      trackApplicantEvent("applicant.materials.ready", {
        applicationId,
        actorId: actor.id,
        chapterId: refreshed.applicant?.chapterId ?? null,
        status: refreshed.status,
      });
    }

    revalidatePath(`/applications/instructor/${applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[uploadApplicantDocument]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

// ─── Delete (soft) applicant document ────────────────────────────────────────

/**
 * Admin or Chapter Lead soft-delete: sets supersededAt, recomputes materialsReadyAt.
 * Expected formData fields: documentId
 */
export async function deleteApplicantDocument(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const documentId = getString(formData, "documentId");

    const doc = await prisma.applicantDocument.findUnique({
      where: { id: documentId },
      select: { id: true, applicationId: true, kind: true, supersededAt: true },
    });
    if (!doc) return { success: false, error: "Document not found." };
    if (doc.supersededAt) return { success: false, error: "Document is already removed." };

    const appCtx = await getApplicationContext(doc.applicationId);
    const actor = await getHiringActor(session.user.id);

    const canDelete =
      actor.roles.includes("ADMIN") ||
      (actor.roles.includes("CHAPTER_PRESIDENT") &&
        actor.chapterId === appCtx.applicantChapterId);
    if (!canDelete) {
      return { success: false, error: "Only Admins or Chapter Presidents can remove uploaded documents." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.applicantDocument.update({
        where: { id: documentId },
        data: { supersededAt: new Date() },
      });
      await recomputeMaterialsReadyAt(doc.applicationId, tx);
      await writeTimelineEvent(
        doc.applicationId,
        "DOC_REMOVED",
        actor.id,
        { documentId, kind: doc.kind },
        tx
      );
    });

    revalidatePath(`/applications/instructor/${doc.applicationId}`);
    revalidatePath("/admin/instructor-applicants");
    return { success: true };
  } catch (error) {
    console.error("[deleteApplicantDocument]", error);
    return { success: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

// ─── Get applicant documents ──────────────────────────────────────────────────

/**
 * Returns all documents for an application the caller is permitted to view.
 * Includes superseded documents for audit history (supersededAt IS NOT NULL).
 */
export async function getApplicantDocuments(applicationId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const appCtx = await getApplicationContext(applicationId);
  const actor = await getHiringActor(session.user.id);
  assertCanViewApplicant(actor, appCtx);

  return prisma.applicantDocument.findMany({
    where: { applicationId },
    select: {
      id: true,
      kind: true,
      fileUrl: true,
      originalName: true,
      fileSize: true,
      note: true,
      uploadedAt: true,
      supersededAt: true,
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ kind: "asc" }, { uploadedAt: "desc" }],
  });
}
