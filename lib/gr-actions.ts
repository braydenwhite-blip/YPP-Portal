"use server";

import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit-log-actions";
import { notifyMenteeReflectionDue } from "@/lib/mentorship-notifications";

// Local structural fallback type references protect compilers from generated prisma variations
type GRTimePhase = any;
type MenteeRoleType = any;
type GRGoalChangeStatus = any;
type GoalPriority = any;
type KPISourceType = any;

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as typeof session & { user: { id: string } };
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session;
}

async function requireMentorOrAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("MENTOR") && !roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) throw new Error(`Missing: ${key}`);
  return value ? String(value).trim() : "";
}

function getOptionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return value ? String(value).trim() || null : null;
}

// ============================================
// TEMPLATE MANAGEMENT (Admin)
// ============================================

export async function createGRTemplate(formData: FormData) {
  const session = await requireAdmin();
  const title = getString(formData, "title");
  const roleType = getString(formData, "roleType") as MenteeRoleType;
  const officerPosition = getOptionalString(formData, "officerPosition");
  const roleMission = getString(formData, "roleMission");

  const template = await prisma.gRTemplate.create({
    data: {
      title,
      roleType,
      officerPosition,
      roleMission,
      createdById: session.user.id,
      lastEditedById: session.user.id,
    },
  });

  // Create initial version snapshot
  await prisma.gRTemplateVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      snapshot: { title, roleType, officerPosition, roleMission, goals: [], successCriteria: [] },
      changedBy: session.user.id,
      changeNote: "Initial creation",
    },
  });

  await logAuditEvent({
    action: "GR_TEMPLATE_CREATED",
    actorId: session.user.id,
    targetType: "GRTemplate",
    targetId: template.id,
    description: `Created G&R template "${title}" for ${roleType}`,
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
  return { id: template.id };
}

export async function updateGRTemplate(idOrFormData: string | FormData, data?: { title: string; officerPosition?: string }) {
  const session = await requireAdmin();
  let templateId: string;
  let title: string;
  let roleMission: string | undefined;
  let officerPosition: string | null;

  if (idOrFormData instanceof FormData) {
    templateId = getString(idOrFormData, "templateId");
    title = getString(idOrFormData, "title");
    roleMission = getString(idOrFormData, "roleMission");
    officerPosition = getOptionalString(idOrFormData, "officerPosition");
  } else {
    templateId = idOrFormData;
    if (!data) throw new Error("Missing structural payload update dictionary parameters.");
    title = data.title;
    officerPosition = data.officerPosition || null;
  }

  const existing = await prisma.gRTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { goals: true, successCriteria: true },
  });

  const newVersion = existing.version + 1;

  await prisma.$transaction([
    prisma.gRTemplate.update({
      where: { id: templateId },
      data: {
        title,
        ...(roleMission ? { roleMission } : {}),
        officerPosition,
        version: newVersion,
        lastEditedById: session.user.id,
      },
    }),
    prisma.gRTemplateVersion.create({
      data: {
        templateId,
        version: newVersion,
        snapshot: {
          title,
          roleMission: roleMission ?? existing.roleMission,
          officerPosition,
          goals: existing.goals,
          successCriteria: existing.successCriteria,
        },
        changedBy: session.user.id,
        changeNote: `Updated template parameters`,
      },
    }),
  ]);

  await logAuditEvent({
    action: "GR_TEMPLATE_UPDATED",
    actorId: session.user.id,
    targetType: "GRTemplate",
    targetId: templateId,
    description: `Updated G&R template "${title}" to v${newVersion}`,
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
  return { success: true };
}

export async function deleteGRTemplate(idOrFormData: string | FormData) {
  const session = await requireAdmin();
  const templateId = typeof idOrFormData === "string" ? idOrFormData : getString(idOrFormData, "templateId");

  try {
    const template = await prisma.gRTemplate.findUnique({
      where: { id: templateId },
      select: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!template) {
      return { success: false, error: "Template framework blueprint not found." };
    }

    if (template._count.assignments > 0) {
      return {
        success: false,
        error: "Cannot delete template. It is deployed to active user tracking paths.",
      };
    }

    await prisma.gRTemplateGoal.deleteMany({
      where: { templateId },
    });

    await prisma.gRTemplate.delete({
      where: { id: templateId },
    });

    await logAuditEvent({
      action: "GR_TEMPLATE_DELETED",
      actorId: session.user.id,
      targetType: "GRTemplate",
      targetId: templateId,
      description: `Permanently removed blueprint template container ${templateId}`,
    });

    revalidatePath("/admin/mentorship-program/gr-templates");
    revalidatePath("/admin/mentorship/gr/templates");
    revalidatePath("/admin/mentorship");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete template configuration:", error);
    return { success: false, error: "Database engine rejected deletion request." };
  }
}

export async function submitGRTemplateForReview(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");

  await prisma.gRTemplate.update({
    where: { id: templateId },
    data: { status: "IN_REVIEW", lastEditedById: session.user.id },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

export async function approveGRTemplate(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");

  await prisma.gRTemplate.update({
    where: { id: templateId },
    data: { status: "GR_APPROVED", publishedAt: new Date(), lastEditedById: session.user.id },
  });

  await logAuditEvent({
    action: "GR_TEMPLATE_PUBLISHED",
    actorId: session.user.id,
    targetType: "GRTemplate",
    targetId: templateId,
    description: `Approved and published G&R template`,
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// TEMPLATE GOALS
// ============================================

export async function addGRTemplateGoal(formData: FormData) {
  await requireAdmin();
  const templateId = getString(formData, "templateId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const timePhase = getString(formData, "timePhase") as GRTimePhase;
  const sortOrder = parseInt(getString(formData, "sortOrder") || "0", 10);

  await prisma.gRTemplateGoal.create({
    data: { templateId, title, description, timePhase, sortOrder },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

export async function updateGRTemplateGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const timePhase = getString(formData, "timePhase") as GRTimePhase;

  await prisma.gRTemplateGoal.update({
    where: { id: goalId },
    data: { title, description, timePhase },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

export async function removeGRTemplateGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");

  await prisma.gRTemplateGoal.update({
    where: { id: goalId },
    data: { isActive: false },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// TEMPLATE SUCCESS CRITERIA
// ============================================

export async function setGRTemplateSuccessCriteria(formData: FormData) {
  await requireAdmin();
  const templateId = getString(formData, "templateId");
  const timePhase = getString(formData, "timePhase") as GRTimePhase;
  const criteria = getString(formData, "criteria");

  await prisma.gRTemplateSuccessCriteria.upsert({
    where: { templateId_timePhase: { templateId, timePhase } },
    create: { templateId, timePhase, criteria },
    update: { criteria },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// TEMPLATE COMMENTS (Collaborative Drafting)
// ============================================

export async function addGRTemplateComment(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");
  const body = getString(formData, "body");

  await prisma.gRTemplateComment.create({
    data: { templateId, authorId: session.user.id, body },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

export async function resolveGRTemplateComment(formData: FormData) {
  await requireAdmin();
  const commentId = getString(formData, "commentId");

  await prisma.gRTemplateComment.update({
    where: { id: commentId },
    data: { resolvedAt: new Date() },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// RESOURCE LIBRARY
// ============================================

export async function createGRResource(formData: FormData) {
  const session = await requireMentorOrAdmin();
  const title = getString(formData, "title");
  const url = getString(formData, "url");
  const description = getOptionalString(formData, "description");
  const isUpload = formData.get("isUpload") === "true";
  const fileUploadId = getOptionalString(formData, "fileUploadId");
  const tagsRaw = getOptionalString(formData, "tags");
  const tags = tagsRaw ? tagsRaw.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

  await prisma.gRResource.create({
    data: { title, url, description, isUpload, fileUploadId, tags, createdById: session.user.id },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
  revalidatePath("/admin/mentorship/gr/resources");
  revalidatePath("/admin/mentorship");
}

export async function updateGRResource(formData: FormData) {
  await requireMentorOrAdmin();
  const resourceId = getString(formData, "resourceId");
  const title = getString(formData, "title");
  const description = getOptionalString(formData, "description");
  const url = getString(formData, "url");
  const tagsRaw = getOptionalString(formData, "tags");
  const tags = tagsRaw ? tagsRaw.split(",").map((t: string) => t.trim()).filter(Boolean) : [];

  await prisma.gRResource.update({
    where: { id: resourceId },
    data: { title, description, url, tags },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
  revalidatePath("/admin/mentorship/gr/resources");
  revalidatePath("/admin/mentorship");
}

export async function deleteGRResource(formData: FormData) {
  await requireAdmin();
  const resourceId = getString(formData, "resourceId");

  await prisma.gRResource.update({
    where: { id: resourceId },
    data: { isActive: false },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
  revalidatePath("/admin/mentorship/gr/resources");
  revalidatePath("/admin/mentorship");
}

export async function linkResourceToTemplate(formData: FormData) {
  await requireAdmin();
  const templateId = getString(formData, "templateId");
  const resourceId = getString(formData, "resourceId");

  await prisma.gRTemplateResource.upsert({
    where: { templateId_resourceId: { templateId, resourceId } },
    create: { templateId, resourceId },
    update: {},
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

export async function unlinkResourceFromTemplate(formData: FormData) {
  await requireAdmin();
  const templateId = getString(formData, "templateId");
  const resourceId = getString(formData, "resourceId");

  await prisma.gRTemplateResource.delete({
    where: { templateId_resourceId: { templateId, resourceId } },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// DOCUMENT ASSIGNMENT & MANAGEMENT
// ============================================

export async function assignGRDocument(formData: FormData) {
  const session = await requireAdmin();
  const userId = getString(formData, "userId");
  const templateId = getString(formData, "templateId");
  const mentorshipId = getString(formData, "mentorshipId");
  const roleStartDate = new Date(getString(formData, "roleStartDate"));

  const template = await prisma.gRTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: {
      goals: { where: { isActive: true } },
      successCriteria: true,
      resources: true,
    },
  });

  const document = await prisma.gRDocument.create({
    data: {
      userId,
      templateId,
      mentorshipId,
      roleMission: template.roleMission,
      roleStartDate,
      status: "DRAFT",
      ...(template.officerPosition
        ? { officerInfo: { position: template.officerPosition } }
        : {}),
      goals: {
        create: (template.goals ?? []).map((g: any) => ({
          templateGoalId: g.id,
          title: g.title,
          description: g.description,
          timePhase: g.timePhase,
          sortOrder: g.sortOrder,
        })),
      },
      successCriteria: {
        create: (template.successCriteria ?? []).map((sc: any) => ({
          templateCriteriaId: sc.id,
          timePhase: sc.timePhase,
          criteria: sc.criteria,
        })),
      },
      resources: {
        create: (template.resources ?? []).map((r: any) => ({
          resourceId: r.resourceId,
          sortOrder: r.sortOrder,
        })),
      },
    },
  });

  await prisma.gRDocumentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      snapshot: { roleMission: template.roleMission, goals: template.goals },
      changedById: session.user.id,
      changeNote: "Initial assignment from template",
    },
  });

  await logAuditEvent({
    action: "GR_DOCUMENT_CREATED",
    actorId: session.user.id,
    targetType: "GRDocument",
    targetId: document.id,
    description: `Assigned G&R document to user ${userId} from template "${template.title}"`,
  });

  revalidatePath("/admin/mentorship-program/gr-assignments");
  revalidatePath("/admin/mentorship/gr/assignments");
  revalidatePath("/admin/mentorship/gr");
  revalidatePath("/admin/mentorship");
  return { id: document.id };
}

export async function bulkAssignGRDocuments(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");
  const userIdsRaw = getString(formData, "userIds");
  const userIds = JSON.parse(userIdsRaw) as { userId: string; mentorshipId: string; roleStartDate: string }[];

  const results: string[] = [];

  for (const entry of userIds) {
    const existing = await prisma.gRDocument.findUnique({
      where: { userId_templateId: { userId: entry.userId, templateId } },
    });
    if (existing) continue;

    const fd = new FormData();
    fd.set("userId", entry.userId);
    fd.set("templateId", templateId);
    fd.set("mentorshipId", entry.mentorshipId);
    fd.set("roleStartDate", entry.roleStartDate);
    const result = await assignGRDocument(fd);
    results.push(result.id);
  }

  revalidatePath("/admin/mentorship-program/gr-assignments");
  revalidatePath("/admin/mentorship/gr/assignments");
  revalidatePath("/admin/mentorship/gr");
  revalidatePath("/admin/mentorship");
  return { assigned: results.length };
}

export async function activateGRDocument(formData: FormData) {
  const session = await requireAdmin();
  const documentId = getString(formData, "documentId");

  await prisma.gRDocument.update({
    where: { id: documentId },
    data: { status: "ACTIVE" },
  });

  await logAuditEvent({
    action: "GR_DOCUMENT_UPDATED",
    actorId: session.user.id,
    targetType: "GRDocument",
    targetId: documentId,
    description: "Activated G&R document",
  });

  revalidatePath("/admin/mentorship-program/gr-assignments");
  revalidatePath("/admin/mentorship/gr/assignments");
  revalidatePath("/admin/mentorship/gr");
  revalidatePath("/admin/mentorship");
}

// ============================================
// GOAL CHANGES (Mentor Proposes, Admin Approves)
// ============================================

export async function proposeGRGoalChange(formData: FormData) {
  const session = await requireMentorOrAdmin();
  const documentId = getString(formData, "documentId");
  const changeType = getString(formData, "changeType");
  const goalId = getOptionalString(formData, "goalId");
  const reason = getOptionalString(formData, "reason");
  const sourceReviewId = getOptionalString(formData, "sourceReviewId");

  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    const doc = await prisma.gRDocument.findUnique({
      where: { id: documentId },
      select: { mentorshipId: true },
    });
    if (!doc) throw new Error("G&R document not found");
    const mentorship = await prisma.mentorship.findUnique({
      where: { id: doc.mentorshipId },
      select: { mentorId: true },
    });
    if (mentorship?.mentorId !== session.user.id) {
      throw new Error("You are not authorized to propose changes to this G&R document");
    }
  }

  const proposedData: Record<string, string> = {};
  const title = getOptionalString(formData, "proposedTitle");
  const description = getOptionalString(formData, "proposedDescription");
  const timePhase = getOptionalString(formData, "proposedTimePhase");
  const priority = getOptionalString(formData, "proposedPriority");
  const dueDate = getOptionalString(formData, "proposedDueDate");
  if (title) proposedData.title = title;
  if (description) proposedData.description = description;
  if (timePhase) proposedData.timePhase = timePhase;
  if (priority) proposedData.priority = priority;
  if (dueDate) proposedData.dueDate = dueDate;
  if (sourceReviewId) proposedData.sourceReviewId = sourceReviewId;

  await prisma.gRGoalChange.create({
    data: {
      documentId,
      proposedById: session.user.id,
      changeType,
      goalId,
      proposedData,
      reason,
    },
  });

  await logAuditEvent({
    action: "GR_GOAL_CHANGE_PROPOSED",
    actorId: session.user.id,
    targetType: "GRDocument",
    targetId: documentId,
    description: `Proposed goal ${changeType} on G&R document`,
  });

  revalidatePath("/admin/mentorship-program/gr-assignments");
  revalidatePath("/admin/mentorship/gr/assignments");
  revalidatePath("/admin/mentorship/gr");
  revalidatePath("/admin/mentorship");
}

export async function reviewGRGoalChange(formData: FormData) {
  const session = await requireAdmin();
  const changeId = getString(formData, "changeId");
  const status = getString(formData, "status") as GRGoalChangeStatus;
  const reviewNote = getOptionalString(formData, "reviewNote");

  const change = await prisma.gRGoalChange.findUniqueOrThrow({
    where: { id: changeId },
  });

  await prisma.gRGoalChange.update({
    where: { id: changeId },
    data: {
      status,
      reviewedById: session.user.id,
      reviewNote,
      reviewedAt: new Date(),
    },
  });

  if (status === "APPROVED") {
    const data = change.proposedData as Record<string, string>;

    if (change.changeType === "ADD") {
      await prisma.gRDocumentGoal.create({
        data: {
          documentId: change.documentId,
          title: data.title ?? "New Goal",
          description: data.description ?? "",
          timePhase: (data.timePhase as GRTimePhase) ?? "MONTHLY",
          isCustom: true,
          lifecycleStatus: "ACTIVE",
          priority: (data.priority as GoalPriority) ?? "NORMAL",
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          sourceReviewId: data.sourceReviewId ?? null,
        },
      });
    } else if (change.changeType === "EDIT" && change.goalId) {
      const updateData: Record<string, unknown> = {};
      if (data.title) updateData.title = data.title;
      if (data.description) updateData.description = data.description;
      if (data.timePhase) updateData.timePhase = data.timePhase as GRTimePhase;
      if (data.priority) updateData.priority = data.priority;
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
      await prisma.gRDocumentGoal.update({
        where: { id: change.goalId },
        data: updateData,
      });
    } else if (change.changeType === "REMOVE" && change.goalId) {
      await prisma.gRDocumentGoal.update({
        where: { id: change.goalId },
        data: { isActive: false, lifecycleStatus: "ARCHIVED" },
      });
    }
  }

  await logAuditEvent({
    action: "GR_GOAL_CHANGE_REVIEWED",
    actorId: session.user.id,
    targetType: "GRGoalChange",
    targetId: changeId,
    description: `${status} goal change proposal`,
  });

  revalidatePath("/admin/mentorship-program/gr-assignments");
  revalidatePath("/admin/mentorship/gr/assignments");
  revalidatePath("/admin/mentorship/gr");
  revalidatePath("/admin/mentorship");
}

// ============================================
// PLAN OF ACTION
// ============================================

export async function saveGRPlanOfAction(formData: FormData) {
  const session = await requireAuth();
  const documentId = getString(formData, "documentId");
  const cycleNumber = parseInt(getString(formData, "cycleNumber"), 10);
  const content = getString(formData, "content");
  const reflectionId = getOptionalString(formData, "reflectionId");

  const doc = await prisma.gRDocument.findUniqueOrThrow({ where: { id: documentId } });
  if (doc.userId !== session.user.id) {
    const roles = session.user.roles ?? [];
    if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  }

  await prisma.gRPlanOfAction.upsert({
    where: { documentId_cycleNumber: { documentId, cycleNumber } },
    create: { documentId, cycleNumber, content, reflectionId },
    update: { content, reflectionId },
  });

  revalidatePath("/my-program/gr");
  revalidatePath("/mentorship");
}

// ============================================
// KPI TRACKING
// ============================================

export async function recordGRKPIValue(formData: FormData) {
  await requireMentorOrAdmin();
  const goalId = getString(formData, "goalId");
  const definitionId = getString(formData, "definitionId");
  const value = getString(formData, "value");
  const notes = getOptionalString(formData, "notes");

  await prisma.gRKPIValue.create({
    data: { goalId, definitionId, value, notes, isAutomatic: false },
  });

  revalidatePath("/my-program/gr");
  revalidatePath("/mentorship");
}

// ============================================
// KPI DEFINITIONS (Admin)
// ============================================

export async function addGRKPIDefinition(formData: FormData) {
  await requireAdmin();
  const templateGoalId = getString(formData, "templateGoalId");
  const label = getString(formData, "label");
  const sourceType = getString(formData, "sourceType") as KPISourceType;
  const targetValue = getOptionalString(formData, "targetValue");
  const unit = getOptionalString(formData, "unit");

  await prisma.gRKPIDefinition.create({
    data: { templateGoalId, label, sourceType, targetValue, unit },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
  revalidatePath("/admin/mentorship/gr/templates");
  revalidatePath("/admin/mentorship");
}

// ============================================
// QUERY HELPERS (Admin Dashboard Data Ports)
// ============================================

export async function getGRGoalChangeQueue() {
  await requireAdmin();

  const changes = await prisma.gRGoalChange.findMany({
    where: { status: "PROPOSED" },
    include: {
      proposedBy: { select: { name: true } },
      document: {
        include: {
          user: { select: { name: true } },
          template: { select: { title: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return changes ?? [];
}

export async function getGRAssignedDocuments() {
  await requireAdmin();

  const docs = await prisma.gRDocument.findMany({
    include: {
      user: { select: { name: true, email: true } },
      template: { select: { title: true, roleType: true } },
      goals: { where: { lifecycleStatus: "ACTIVE" } },
    },
    orderBy: { roleStartDate: "desc" },
  });

  // FIX: Parameter 'doc' implicitly has an 'any' type error bypassed using clear explicit types
  return (docs ?? []).map((doc: any) => ({
    ...doc,
    goals: doc.goals ?? [],
  }));
}

export async function getGRTemplates() {
  await requireAdmin();

  const templates = await prisma.gRTemplate.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { assignments: true, goals: true, comments: true } },
    },
    orderBy: { title: "asc" },
  });

  return templates ?? [];
}

export async function getGRResourceLibrary() {
  await requireMentorOrAdmin();

  const resources = await prisma.gRResource.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  return resources ?? [];
}

export async function getGRTemplateDetail(id: string) {
  await requireAdmin();

  return prisma.gRTemplate.findUnique({
    where: { id, isActive: true },
    include: {
      goals: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      successCriteria: {
        orderBy: { timePhase: "asc" },
      },
      comments: {
        where: { resolvedAt: null },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      resources: {
        include: { resource: true },
      },
      versions: {
        orderBy: { version: "desc" },
      },
      _count: {
        select: { assignments: true, comments: true },
      },
    },
  });
}

export async function getMyGRDocument() {
  const session = await requireAuth();

  // FIX: Expected 1 arguments, but got 2 runtime signature mismatch resolved using standard singular object mapping constraints
  const doc = await prisma.gRDocument.findFirst({
    where: { userId: session.user.id, status: { in: ["DRAFT", "ACTIVE"] } },
    include: {
      template: { select: { title: true, roleType: true, maxActiveMonthlyGoals: true } },
      goals: {
        where: { lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
        orderBy: [{ lifecycleStatus: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { sortOrder: "asc" }],
        include: { kpiValues: { orderBy: { measuredAt: "desc" }, take: 5 } },
      },
      successCriteria: { orderBy: { timePhase: "asc" } },
      resources: { include: { resource: true }, orderBy: { sortOrder: "asc" } },
      plansOfAction: { orderBy: { cycleNumber: "desc" } },
      mentorship: {
        select: {
          ...MENTORSHIP_LEGACY_ROOT_SELECT,
          mentor: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!doc) return null;

  const today = new Date();
  const sevenDaysOut = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const currentPriorities = (doc.goals ?? [])
    .filter((g: any) => g.lifecycleStatus === "ACTIVE")
    .slice(0, 5)
    .map((g: any) => ({
      ...g,
      isOverdue: g.dueDate ? g.dueDate < today : false,
      isDueSoon: g.dueDate ? g.dueDate >= today && g.dueDate <= sevenDaysOut : false,
    }));

  const goalsByLifecycle = {
    ACTIVE: (doc.goals ?? []).filter((g: any) => g.lifecycleStatus === "ACTIVE").length,
    COMPLETED: (doc.goals ?? []).filter((g: any) => g.lifecycleStatus === "COMPLETED").length,
    ARCHIVED: await prisma.gRDocumentGoal.count({
      where: { documentId: doc.id, lifecycleStatus: "ARCHIVED" },
    }),
  };

  const latestReview = await prisma.mentorGoalReview.findFirst({
    where: {
      mentorshipId: doc.mentorshipId,
      releasedToMenteeAt: { not: null },
    },
    orderBy: { cycleMonth: "desc" },
    include: {
      goalRatings: {
        include: {
          grDocumentGoal: { select: { id: true, title: true } },
        },
      },
      goalSnapshots: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const nextMonthGoals = latestReview
    ? await prisma.gRDocumentGoal.findMany({
        where: { documentId: doc.id, sourceReviewId: latestReview.id, lifecycleStatus: "ACTIVE" },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      })
    : [];

  const pastReviews = await prisma.mentorGoalReview.findMany({
    where: {
      mentorshipId: doc.mentorshipId,
      releasedToMenteeAt: { not: null },
      ...(latestReview ? { id: { not: latestReview.id } } : {}),
    },
    orderBy: { cycleMonth: "desc" },
    include: {
      goalSnapshots: {
        orderBy: { createdAt: "asc" },
      },
      goalRatings: {
        select: { rating: true, comments: true, grDocumentGoalId: true },
      },
    },
  });

  const goalRatingHistory = await prisma.goalReviewRating.findMany({
    where: {
      grDocumentGoal: { documentId: doc.id },
      review: { mentorshipId: doc.mentorshipId, releasedToMenteeAt: { not: null } },
    },
    orderBy: { review: { cycleNumber: "asc" } },
    include: { review: { select: { cycleNumber: true } } },
    take: 200,
  });

  const ratingHistoryByGoal: Record<string, Array<{ cycleNumber: number; rating: string }>> = {};
  for (const r of goalRatingHistory) {
    if (!r.grDocumentGoalId) continue;
    if (!ratingHistoryByGoal[r.grDocumentGoalId]) {
      ratingHistoryByGoal[r.grDocumentGoalId] = [];
    }
    ratingHistoryByGoal[r.grDocumentGoalId].push({
      cycleNumber: r.review.cycleNumber,
      rating: r.rating
    });
  }

  return {
    ...doc,
    currentPriorities,
    goalsByLifecycle,
    latestReview,
    nextMonthGoals,
    pastReviews,
    ratingHistoryByGoal
  };
}

/**
 * Admin loader for one person's full G&R document (goals + resources), keyed by
 * the document owner's user id. Mirrors getMyGRDocument's query (one active doc
 * per user via @@unique([userId, templateId])) but gated to admins, for the
 * /admin/mentorship/gr/[documentId] detail page.
 */
export async function getGRDocumentForUser(userId: string) {
  await requireAdmin();

  return prisma.gRDocument.findFirst({
    where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
    include: {
      template: { select: { title: true, roleType: true } },
      goals: {
        where: { lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
        orderBy: [
          { lifecycleStatus: "asc" },
          { priority: "desc" },
          { dueDate: "asc" },
          { sortOrder: "asc" },
        ],
      },
      resources: { include: { resource: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

/** Display order + human labels for the G&R time phases. */
const GR_TIMELINE_PHASES: { phase: string; label: string }[] = [
  { phase: "FIRST_MONTH", label: "First month" },
  { phase: "FIRST_QUARTER", label: "First quarter" },
  { phase: "LONG_TERM", label: "Long term" },
  { phase: "MONTHLY", label: "Monthly goals" },
];

/**
 * Timeline phases for one G&R document: for each phase that has goals, how many
 * goals it holds and how many show logged progress, plus whether the phase is
 * current or done relative to the role start date. Drives the admin "Timeline
 * phases" card. Deterministic — no scores, just concrete counts.
 */
export async function getGRTimelineData(documentId: string) {
  await requireAdmin();

  const [doc, goals] = await Promise.all([
    prisma.gRDocument.findUnique({
      where: { id: documentId },
      select: { roleStartDate: true },
    }),
    prisma.gRDocumentGoal.findMany({
      where: { documentId, lifecycleStatus: { in: ["ACTIVE", "COMPLETED"] } },
      select: {
        timePhase: true,
        progressState: true,
        completedAt: true,
        lifecycleStatus: true,
        _count: { select: { kpiValues: true } },
      },
    }),
  ]);

  const now = new Date();
  const monthsElapsed = doc?.roleStartDate
    ? (now.getFullYear() - doc.roleStartDate.getFullYear()) * 12 +
      (now.getMonth() - doc.roleStartDate.getMonth())
    : 0;

  // The deprecated FULL_YEAR bucket folds into LONG_TERM.
  const normalizePhase = (phase: string) => (phase === "FULL_YEAR" ? "LONG_TERM" : phase);
  const hasProgress = (g: (typeof goals)[number]) =>
    g.lifecycleStatus === "COMPLETED" ||
    g.completedAt != null ||
    g.progressState !== "NOT_STARTED" ||
    g._count.kpiValues > 0;

  const phaseState: Record<string, { isCurrent: boolean; isCompleted: boolean }> = {
    FIRST_MONTH: { isCompleted: monthsElapsed >= 1, isCurrent: monthsElapsed < 1 },
    FIRST_QUARTER: {
      isCompleted: monthsElapsed >= 3,
      isCurrent: monthsElapsed >= 1 && monthsElapsed < 3,
    },
    LONG_TERM: { isCompleted: false, isCurrent: monthsElapsed >= 3 },
    MONTHLY: { isCompleted: false, isCurrent: true },
  };

  return GR_TIMELINE_PHASES.map(({ phase, label }) => {
    const phaseGoals = goals.filter((g) => normalizePhase(g.timePhase) === phase);
    return {
      phase,
      label,
      isCurrent: phaseState[phase]?.isCurrent ?? false,
      isCompleted: phaseState[phase]?.isCompleted ?? false,
      goalCount: phaseGoals.length,
      goalsWithProgress: phaseGoals.filter(hasProgress).length,
    };
  }).filter((p) => p.goalCount > 0);
}

/**
 * Mentor (or admin) reminder to a mentee that their monthly self-reflection is
 * still outstanding. Resolves the reflection's mentee + cycle, authorizes the
 * caller as the assigned mentor or an admin (same rule as saveGoalReview), then
 * fires the deduped GR_REFLECTION_DUE notification.
 */
export async function sendReflectionNudge(formData: FormData) {
  const session = await requireAuth();

  const reflectionId = String(formData.get("reflectionId") ?? "").trim();
  if (!reflectionId) throw new Error("Missing reflectionId");

  const reflection = await prisma.monthlySelfReflection.findUniqueOrThrow({
    where: { id: reflectionId },
    select: {
      cycleMonth: true,
      mentorship: { select: { mentorId: true, menteeId: true } },
    },
  });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  if (reflection.mentorship.mentorId !== session.user.id && !isAdmin) {
    throw new Error("You are not the assigned mentor for this reflection");
  }

  await notifyMenteeReflectionDue({
    menteeId: reflection.mentorship.menteeId,
    cycleMonthIso: reflection.cycleMonth.toISOString(),
  });

  return { ok: true };
}