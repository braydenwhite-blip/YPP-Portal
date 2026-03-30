"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  GRTimePhase,
  GRTemplateStatus,
  GRDocumentStatus,
  GRGoalChangeStatus,
  MenteeRoleType,
} from "@prisma/client";
import { logAuditEvent } from "@/lib/audit-log-actions";

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
  return { id: template.id };
}

export async function updateGRTemplate(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");
  const title = getString(formData, "title");
  const roleMission = getString(formData, "roleMission");
  const officerPosition = getOptionalString(formData, "officerPosition");

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
        roleMission,
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
          roleMission,
          officerPosition,
          goals: existing.goals,
          successCriteria: existing.successCriteria,
        },
        changedBy: session.user.id,
        changeNote: `Updated template`,
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
}

export async function submitGRTemplateForReview(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");

  await prisma.gRTemplate.update({
    where: { id: templateId },
    data: { status: "IN_REVIEW", lastEditedById: session.user.id },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
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
}

export async function removeGRTemplateGoal(formData: FormData) {
  await requireAdmin();
  const goalId = getString(formData, "goalId");

  await prisma.gRTemplateGoal.update({
    where: { id: goalId },
    data: { isActive: false },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
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
}

export async function resolveGRTemplateComment(formData: FormData) {
  await requireAdmin();
  const commentId = getString(formData, "commentId");

  await prisma.gRTemplateComment.update({
    where: { id: commentId },
    data: { resolvedAt: new Date() },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
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
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  await prisma.gRResource.create({
    data: { title, url, description, isUpload, fileUploadId, tags, createdById: session.user.id },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
}

export async function updateGRResource(formData: FormData) {
  await requireMentorOrAdmin();
  const resourceId = getString(formData, "resourceId");
  const title = getString(formData, "title");
  const description = getOptionalString(formData, "description");
  const url = getString(formData, "url");
  const tagsRaw = getOptionalString(formData, "tags");
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  await prisma.gRResource.update({
    where: { id: resourceId },
    data: { title, description, url, tags },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
}

export async function deleteGRResource(formData: FormData) {
  await requireAdmin();
  const resourceId = getString(formData, "resourceId");

  await prisma.gRResource.update({
    where: { id: resourceId },
    data: { isActive: false },
  });

  revalidatePath("/admin/mentorship-program/gr-resources");
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
}

export async function unlinkResourceFromTemplate(formData: FormData) {
  await requireAdmin();
  const templateId = getString(formData, "templateId");
  const resourceId = getString(formData, "resourceId");

  await prisma.gRTemplateResource.delete({
    where: { templateId_resourceId: { templateId, resourceId } },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
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
      goals: {
        create: template.goals.map((g) => ({
          templateGoalId: g.id,
          title: g.title,
          description: g.description,
          timePhase: g.timePhase,
          sortOrder: g.sortOrder,
        })),
      },
      successCriteria: {
        create: template.successCriteria.map((sc) => ({
          templateCriteriaId: sc.id,
          timePhase: sc.timePhase,
          criteria: sc.criteria,
        })),
      },
      resources: {
        create: template.resources.map((r) => ({
          resourceId: r.resourceId,
          sortOrder: r.sortOrder,
        })),
      },
    },
  });

  // Create initial version
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
  return { id: document.id };
}

export async function bulkAssignGRDocuments(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");
  const userIdsRaw = getString(formData, "userIds");
  const userIds = JSON.parse(userIdsRaw) as { userId: string; mentorshipId: string; roleStartDate: string }[];

  const results: string[] = [];

  for (const entry of userIds) {
    // Skip if already assigned
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

  const proposedData: Record<string, string> = {};
  const title = getOptionalString(formData, "proposedTitle");
  const description = getOptionalString(formData, "proposedDescription");
  const timePhase = getOptionalString(formData, "proposedTimePhase");
  if (title) proposedData.title = title;
  if (description) proposedData.description = description;
  if (timePhase) proposedData.timePhase = timePhase;

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

  // If approved, apply the change
  if (status === "APPROVED") {
    const data = change.proposedData as Record<string, string>;

    if (change.changeType === "ADD") {
      await prisma.gRDocumentGoal.create({
        data: {
          documentId: change.documentId,
          title: data.title ?? "New Goal",
          description: data.description ?? "",
          timePhase: (data.timePhase as GRTimePhase) ?? "FIRST_MONTH",
          isCustom: true,
        },
      });
    } else if (change.changeType === "EDIT" && change.goalId) {
      const updateData: Record<string, string> = {};
      if (data.title) updateData.title = data.title;
      if (data.description) updateData.description = data.description;
      if (data.timePhase) updateData.timePhase = data.timePhase;
      await prisma.gRDocumentGoal.update({
        where: { id: change.goalId },
        data: updateData,
      });
    } else if (change.changeType === "REMOVE" && change.goalId) {
      await prisma.gRDocumentGoal.update({
        where: { id: change.goalId },
        data: { isActive: false },
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

  // Verify the user owns this document
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
}

// ============================================
// KPI DEFINITIONS (Admin)
// ============================================

export async function addGRKPIDefinition(formData: FormData) {
  await requireAdmin();
  const templateGoalId = getString(formData, "templateGoalId");
  const label = getString(formData, "label");
  const sourceType = getString(formData, "sourceType") as import("@prisma/client").KPISourceType;
  const targetValue = getOptionalString(formData, "targetValue");
  const unit = getOptionalString(formData, "unit");

  await prisma.gRKPIDefinition.create({
    data: { templateGoalId, label, sourceType, targetValue, unit },
  });

  revalidatePath("/admin/mentorship-program/gr-templates");
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getMyGRDocument() {
  const session = await requireAuth();

  const doc = await prisma.gRDocument.findFirst({
    where: { userId: session.user.id, status: { in: ["DRAFT", "ACTIVE"] } },
    include: {
      template: true,
      goals: {
        where: { isActive: true },
        orderBy: [{ timePhase: "asc" }, { sortOrder: "asc" }],
        include: { kpiValues: { orderBy: { measuredAt: "desc" }, take: 5 } },
      },
      successCriteria: { orderBy: { timePhase: "asc" } },
      resources: { include: { resource: true }, orderBy: { sortOrder: "asc" } },
      plansOfAction: { orderBy: { cycleNumber: "desc" } },
      mentorship: { include: { mentor: { select: { id: true, name: true, email: true } } } },
    },
  });

  return doc;
}

export async function getGRDocumentForUser(userId: string) {
  await requireMentorOrAdmin();

  return prisma.gRDocument.findFirst({
    where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
    include: {
      template: true,
      goals: {
        where: { isActive: true },
        orderBy: [{ timePhase: "asc" }, { sortOrder: "asc" }],
        include: { kpiValues: { orderBy: { measuredAt: "desc" }, take: 5 } },
      },
      successCriteria: { orderBy: { timePhase: "asc" } },
      resources: { include: { resource: true }, orderBy: { sortOrder: "asc" } },
      plansOfAction: { orderBy: { cycleNumber: "desc" } },
      mentorship: { include: { mentor: { select: { id: true, name: true, email: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getGRTemplates(roleType?: MenteeRoleType) {
  await requireAdmin();

  return prisma.gRTemplate.findMany({
    where: { isActive: true, ...(roleType ? { roleType } : {}) },
    include: {
      goals: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      _count: { select: { assignments: true, comments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getGRTemplateDetail(templateId: string) {
  await requireAdmin();

  return prisma.gRTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: {
      goals: { where: { isActive: true }, orderBy: [{ timePhase: "asc" }, { sortOrder: "asc" }], include: { kpiDefinitions: true } },
      successCriteria: { orderBy: { timePhase: "asc" } },
      resources: { include: { resource: true }, orderBy: { sortOrder: "asc" } },
      comments: { where: { resolvedAt: null }, include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      versions: { orderBy: { version: "desc" }, take: 10 },
      createdBy: { select: { name: true } },
      lastEditedBy: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
  });
}

export async function getGRGoalChangeQueue() {
  await requireAdmin();

  return prisma.gRGoalChange.findMany({
    where: { status: "PROPOSED" },
    include: {
      document: { include: { user: { select: { name: true, email: true } }, template: { select: { title: true } } } },
      proposedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getGRDocumentVersionHistory(documentId: string) {
  await requireMentorOrAdmin();

  return prisma.gRDocumentVersion.findMany({
    where: { documentId },
    include: { changedBy: { select: { name: true } } },
    orderBy: { version: "desc" },
  });
}

export async function getGRResourceLibrary(search?: string) {
  await requireMentorOrAdmin();

  return prisma.gRResource.findMany({
    where: {
      isActive: true,
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGRAssignedDocuments() {
  await requireAdmin();

  return prisma.gRDocument.findMany({
    where: { status: { in: ["DRAFT", "ACTIVE"] } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      template: { select: { title: true, roleType: true } },
      mentorship: { include: { mentor: { select: { name: true } } } },
      _count: { select: { goals: true, goalChanges: { where: { status: "PROPOSED" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGRTimelineData(documentId: string) {
  const doc = await prisma.gRDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      goals: { where: { isActive: true }, include: { kpiValues: true } },
    },
  });

  const start = doc.roleStartDate;
  const now = new Date();

  const phases = [
    {
      phase: "FIRST_MONTH" as GRTimePhase,
      label: "First Month",
      startDate: start,
      endDate: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      phase: "FIRST_QUARTER" as GRTimePhase,
      label: "First Quarter",
      startDate: start,
      endDate: new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000),
    },
    {
      phase: "FULL_YEAR" as GRTimePhase,
      label: "Full Year",
      startDate: start,
      endDate: new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000),
    },
  ];

  return phases.map((p) => {
    const phaseGoals = doc.goals.filter((g) => g.timePhase === p.phase);
    const goalsWithKPIs = phaseGoals.filter((g) => g.kpiValues.length > 0).length;
    return {
      ...p,
      goalCount: phaseGoals.length,
      goalsWithProgress: goalsWithKPIs,
      isCurrent: now >= p.startDate && now <= p.endDate,
      isCompleted: now > p.endDate,
      isFuture: now < p.startDate,
    };
  });
}

// ============================================
// BULK UPDATES
// ============================================

export async function applyGRBulkUpdate(formData: FormData) {
  const session = await requireAdmin();
  const templateId = getString(formData, "templateId");
  const policy = getString(formData, "policy");

  if (policy === "NEW_ONLY") {
    // Do nothing -- future assignments will use the updated template
    return;
  }

  const template = await prisma.gRTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { goals: { where: { isActive: true } }, successCriteria: true },
  });

  const documents = await prisma.gRDocument.findMany({
    where: { templateId, status: { in: ["DRAFT", "ACTIVE"] } },
    select: { id: true },
  });

  if (policy === "IMMEDIATE_ALL") {
    for (const doc of documents) {
      // Sync goals from template
      for (const tGoal of template.goals) {
        const existing = await prisma.gRDocumentGoal.findFirst({
          where: { documentId: doc.id, templateGoalId: tGoal.id },
        });
        if (existing) {
          await prisma.gRDocumentGoal.update({
            where: { id: existing.id },
            data: { title: tGoal.title, description: tGoal.description, timePhase: tGoal.timePhase },
          });
        } else {
          await prisma.gRDocumentGoal.create({
            data: {
              documentId: doc.id,
              templateGoalId: tGoal.id,
              title: tGoal.title,
              description: tGoal.description,
              timePhase: tGoal.timePhase,
              sortOrder: tGoal.sortOrder,
            },
          });
        }
      }

      // Sync success criteria
      for (const sc of template.successCriteria) {
        await prisma.gRDocumentSuccessCriteria.upsert({
          where: { documentId_timePhase: { documentId: doc.id, timePhase: sc.timePhase } },
          create: { documentId: doc.id, templateCriteriaId: sc.id, timePhase: sc.timePhase, criteria: sc.criteria },
          update: { criteria: sc.criteria },
        });
      }
    }
  }

  await logAuditEvent({
    action: "GR_BULK_UPDATE",
    actorId: session.user.id,
    targetType: "GRTemplate",
    targetId: templateId,
    description: `Applied bulk update (${policy}) to ${documents.length} documents`,
  });

  revalidatePath("/admin/mentorship-program/gr-assignments");
}
