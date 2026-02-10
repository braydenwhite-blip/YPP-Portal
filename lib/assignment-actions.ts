"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireInstructor() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (
    !session?.user?.id ||
    (!roles.includes("ADMIN") &&
      !roles.includes("INSTRUCTOR") &&
      !roles.includes("CHAPTER_LEAD"))
  ) {
    throw new Error("Unauthorized – instructor role required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true): string {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing required field: ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getInt(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (!raw || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? fallback : n;
}

// ============================================
// CLASS ASSIGNMENT ACTIONS (Enjoyment-Focused)
// ============================================

export async function createClassAssignment(formData: FormData) {
  const session = await requireInstructor();

  const offeringId = getString(formData, "offeringId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const type = getString(formData, "type") as
    | "PRACTICE"
    | "PROJECT"
    | "EXPLORATION"
    | "GROUP"
    | "REFLECTION";
  const feedbackStyle = getString(formData, "feedbackStyle", false) as
    | "NARRATIVE"
    | "CHECKLIST"
    | "VIDEO"
    | "PEER_REVIEW"
    | "";
  const gradingStyle = getString(formData, "gradingStyle", false) as
    | "COMPLETION"
    | "FEEDBACK_ONLY"
    | "OPTIONAL_GRADE"
    | "";

  const instructions = getString(formData, "instructions", false);
  const encouragementNote = getString(formData, "encouragementNote", false);
  const attachmentUrl = getString(formData, "attachmentUrl", false);
  const sessionId = getString(formData, "sessionId", false);

  // Dates
  const suggestedDueDateStr = getString(formData, "suggestedDueDate", false);
  const hardDeadlineStr = getString(formData, "hardDeadline", false);
  const suggestedDueDate = suggestedDueDateStr ? new Date(suggestedDueDateStr) : null;
  const hardDeadline = hardDeadlineStr ? new Date(hardDeadlineStr) : null;

  // Group settings
  const isGroupAssignment = type === "GROUP" || formData.get("isGroupAssignment") === "true";
  const groupSize = getInt(formData, "groupSize", 0) || null;
  const allowSelfSelect = formData.get("allowSelfSelect") !== "false";

  // Arrays
  const referenceLinksRaw = getString(formData, "referenceLinks", false);
  const referenceLinks = referenceLinksRaw
    ? referenceLinksRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const exampleWorkRaw = getString(formData, "exampleWorkUrls", false);
  const exampleWorkUrls = exampleWorkRaw
    ? exampleWorkRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const assignment = await prisma.classAssignment.create({
    data: {
      offeringId,
      createdById: session.user.id,
      title,
      description,
      type,
      feedbackStyle: feedbackStyle || "NARRATIVE",
      gradingStyle: gradingStyle || "FEEDBACK_ONLY",
      suggestedDueDate,
      hardDeadline,
      allowLateSubmissions: true,
      instructions: instructions || null,
      referenceLinks,
      exampleWorkUrls,
      attachmentUrl: attachmentUrl || null,
      isGroupAssignment,
      groupSize,
      allowSelfSelect,
      encouragementNote: encouragementNote || null,
      sessionId: sessionId || null,
    },
  });

  revalidatePath(`/classes/${offeringId}/assignments`);
  return { success: true, id: assignment.id };
}

export async function updateClassAssignment(formData: FormData) {
  const session = await requireInstructor();
  const id = getString(formData, "id");

  const existing = await prisma.classAssignment.findUnique({ where: { id } });
  if (!existing) throw new Error("Assignment not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const type = getString(formData, "type") as
    | "PRACTICE"
    | "PROJECT"
    | "EXPLORATION"
    | "GROUP"
    | "REFLECTION";
  const feedbackStyle = getString(formData, "feedbackStyle", false) as
    | "NARRATIVE"
    | "CHECKLIST"
    | "VIDEO"
    | "PEER_REVIEW"
    | "";
  const gradingStyle = getString(formData, "gradingStyle", false) as
    | "COMPLETION"
    | "FEEDBACK_ONLY"
    | "OPTIONAL_GRADE"
    | "";

  const instructions = getString(formData, "instructions", false);
  const encouragementNote = getString(formData, "encouragementNote", false);

  const suggestedDueDateStr = getString(formData, "suggestedDueDate", false);
  const hardDeadlineStr = getString(formData, "hardDeadline", false);

  const isGroupAssignment = type === "GROUP" || formData.get("isGroupAssignment") === "true";
  const groupSize = getInt(formData, "groupSize", 0) || null;
  const isPublished = formData.get("isPublished") !== "false";

  await prisma.classAssignment.update({
    where: { id },
    data: {
      title,
      description,
      type,
      feedbackStyle: feedbackStyle || "NARRATIVE",
      gradingStyle: gradingStyle || "FEEDBACK_ONLY",
      suggestedDueDate: suggestedDueDateStr ? new Date(suggestedDueDateStr) : null,
      hardDeadline: hardDeadlineStr ? new Date(hardDeadlineStr) : null,
      instructions: instructions || null,
      encouragementNote: encouragementNote || null,
      isGroupAssignment,
      groupSize,
      isPublished,
    },
  });

  revalidatePath(`/classes/${existing.offeringId}/assignments`);
  return { success: true };
}

export async function deleteClassAssignment(id: string) {
  const session = await requireInstructor();
  const existing = await prisma.classAssignment.findUnique({ where: { id } });
  if (!existing) throw new Error("Assignment not found");

  const roles = session.user?.roles ?? [];
  if (existing.createdById !== session.user.id && !roles.includes("ADMIN")) {
    throw new Error("Not authorized");
  }

  await prisma.classAssignment.delete({ where: { id } });
  revalidatePath(`/classes/${existing.offeringId}/assignments`);
  return { success: true };
}

// ============================================
// SUBMISSION ACTIONS
// ============================================

export async function submitAssignmentWork(formData: FormData) {
  const session = await requireAuth();

  const assignmentId = getString(formData, "assignmentId");
  const workUrl = getString(formData, "workUrl", false);
  const workText = getString(formData, "workText", false);
  const studentReflection = getString(formData, "studentReflection", false);
  const enjoymentRating = getInt(formData, "enjoymentRating", 0) || null;
  const difficultyRating = getInt(formData, "difficultyRating", 0) || null;
  const whatWentWell = getString(formData, "whatWentWell", false);
  const whatToImprove = getString(formData, "whatToImprove", false);
  const wouldRecommend = formData.get("wouldRecommend") === "true" ? true
    : formData.get("wouldRecommend") === "false" ? false : null;
  const groupId = getString(formData, "groupId", false);

  const submission = await prisma.classAssignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: session.user.id,
      },
    },
    create: {
      assignmentId,
      studentId: session.user.id,
      workUrl: workUrl || null,
      workText: workText || null,
      submittedAt: new Date(),
      status: "SUBMITTED",
      studentReflection: studentReflection || null,
      enjoymentRating,
      difficultyRating,
      whatWentWell: whatWentWell || null,
      whatToImprove: whatToImprove || null,
      wouldRecommend,
      completionBadge: true,
      groupId: groupId || null,
    },
    update: {
      workUrl: workUrl || null,
      workText: workText || null,
      submittedAt: new Date(),
      status: "SUBMITTED",
      studentReflection: studentReflection || null,
      enjoymentRating,
      difficultyRating,
      whatWentWell: whatWentWell || null,
      whatToImprove: whatToImprove || null,
      wouldRecommend,
      completionBadge: true,
    },
  });

  const assignment = await prisma.classAssignment.findUnique({
    where: { id: assignmentId },
    select: { offeringId: true },
  });

  if (assignment) {
    revalidatePath(`/classes/${assignment.offeringId}/assignments`);
  }
  revalidatePath(`/assignments/${assignmentId}`);
  return { success: true, id: submission.id };
}

export async function saveAssignmentDraft(formData: FormData) {
  const session = await requireAuth();

  const assignmentId = getString(formData, "assignmentId");
  const workUrl = getString(formData, "workUrl", false);
  const workText = getString(formData, "workText", false);
  const groupId = getString(formData, "groupId", false);

  await prisma.classAssignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId: session.user.id,
      },
    },
    create: {
      assignmentId,
      studentId: session.user.id,
      workUrl: workUrl || null,
      workText: workText || null,
      status: "IN_PROGRESS",
      groupId: groupId || null,
    },
    update: {
      workUrl: workUrl || null,
      workText: workText || null,
      status: "IN_PROGRESS",
    },
  });

  return { success: true };
}

// ============================================
// INSTRUCTOR FEEDBACK ACTIONS
// ============================================

export async function giveAssignmentFeedback(formData: FormData) {
  const session = await requireInstructor();

  const submissionId = getString(formData, "submissionId");
  const instructorFeedback = getString(formData, "instructorFeedback", false);
  const celebratoryNote = getString(formData, "celebratoryNote", false);
  const suggestionsForNext = getString(formData, "suggestionsForNext", false);
  const awardBadge = formData.get("awardBadge") === "true";

  await prisma.classAssignmentSubmission.update({
    where: { id: submissionId },
    data: {
      instructorFeedback: instructorFeedback || null,
      celebratoryNote: celebratoryNote || null,
      suggestionsForNext: suggestionsForNext || null,
      feedbackGivenAt: new Date(),
      status: "FEEDBACK_GIVEN",
      completionBadge: awardBadge || undefined,
    },
  });

  const submission = await prisma.classAssignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { select: { offeringId: true } } },
  });

  if (submission) {
    revalidatePath(`/classes/${submission.assignment.offeringId}/assignments`);
  }
  return { success: true };
}

// ============================================
// GROUP PROJECT ACTIONS
// ============================================

export async function createGroupProject(formData: FormData) {
  const session = await requireAuth();

  const assignmentId = getString(formData, "assignmentId");
  const groupName = getString(formData, "groupName");
  const description = getString(formData, "description", false);
  const communicationChannel = getString(formData, "communicationChannel", false);

  const sharedDocLinksRaw = getString(formData, "sharedDocLinks", false);
  const sharedDocLinks = sharedDocLinksRaw
    ? sharedDocLinksRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const group = await prisma.groupProject.create({
    data: {
      assignmentId,
      groupName,
      description: description || null,
      communicationChannel: communicationChannel || null,
      sharedDocLinks,
      members: {
        create: {
          userId: session.user.id,
          role: "Creator",
        },
      },
    },
  });

  const assignment = await prisma.classAssignment.findUnique({
    where: { id: assignmentId },
    select: { offeringId: true },
  });

  if (assignment) {
    revalidatePath(`/classes/${assignment.offeringId}/assignments`);
  }
  return { success: true, id: group.id };
}

export async function joinGroupProject(groupId: string, role?: string) {
  const session = await requireAuth();

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  });

  if (existing) throw new Error("Already a member of this group");

  await prisma.groupMember.create({
    data: {
      groupId,
      userId: session.user.id,
      role: role || null,
    },
  });

  return { success: true };
}

export async function leaveGroupProject(groupId: string) {
  const session = await requireAuth();

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  });

  return { success: true };
}

export async function updateGroupMemberRole(formData: FormData) {
  const session = await requireAuth();

  const groupId = getString(formData, "groupId");
  const userId = getString(formData, "userId");
  const role = getString(formData, "role", false);

  // Verify the caller is a member of this group
  const callerMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  });
  if (!callerMember) throw new Error("Not a member of this group");

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { role: role || null },
  });

  return { success: true };
}

export async function addGroupMilestone(formData: FormData) {
  const session = await requireAuth();

  const groupId = getString(formData, "groupId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const targetDateStr = getString(formData, "targetDate", false);

  // Verify membership
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: session.user.id } },
  });
  if (!member) throw new Error("Not a member of this group");

  const count = await prisma.groupMilestone.count({ where: { groupId } });

  await prisma.groupMilestone.create({
    data: {
      groupId,
      title,
      description: description || null,
      targetDate: targetDateStr ? new Date(targetDateStr) : null,
      sortOrder: count,
    },
  });

  return { success: true };
}

export async function toggleMilestoneComplete(milestoneId: string) {
  const session = await requireAuth();

  const milestone = await prisma.groupMilestone.findUnique({
    where: { id: milestoneId },
    include: { group: { include: { members: true } } },
  });

  if (!milestone) throw new Error("Milestone not found");

  const isMember = milestone.group.members.some((m) => m.userId === session.user.id);
  if (!isMember) throw new Error("Not a member of this group");

  await prisma.groupMilestone.update({
    where: { id: milestoneId },
    data: {
      isComplete: !milestone.isComplete,
      completedAt: milestone.isComplete ? null : new Date(),
    },
  });

  return { success: true };
}

// ============================================
// QUERY HELPERS
// ============================================

export async function getOfferingAssignments(offeringId: string, userId: string) {
  return prisma.classAssignment.findMany({
    where: { offeringId, isPublished: true },
    include: {
      submissions: {
        where: { studentId: userId },
      },
      groups: {
        include: {
          members: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { milestones: true } },
        },
      },
      _count: {
        select: { submissions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssignmentDetail(assignmentId: string) {
  return prisma.classAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      offering: {
        include: {
          instructor: { select: { id: true, name: true } },
          template: { select: { interestArea: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
      submissions: {
        include: {
          student: { select: { id: true, name: true, email: true } },
          group: { select: { id: true, groupName: true } },
        },
        orderBy: { submittedAt: "desc" },
      },
      groups: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
          milestones: { orderBy: { sortOrder: "asc" } },
          _count: { select: { submissions: true } },
        },
      },
    },
  });
}

export async function getGroupProjectDetail(groupId: string) {
  return prisma.groupProject.findUnique({
    where: { id: groupId },
    include: {
      assignment: {
        include: {
          offering: {
            include: {
              instructor: { select: { id: true, name: true } },
            },
          },
        },
      },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      milestones: { orderBy: { sortOrder: "asc" } },
      submissions: {
        include: { student: { select: { id: true, name: true } } },
      },
    },
  });
}
