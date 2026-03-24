"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { computeAllChapterSnapshots } from "./compute-snapshots";
import { evaluateOpsRules } from "./escalation";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not authenticated");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) throw new Error("Unauthorized");
  return session;
}

// ============================================
// SNAPSHOT ACTIONS
// ============================================

export async function triggerSnapshotComputation() {
  await requireAdmin();
  const results = await computeAllChapterSnapshots();
  revalidatePath("/admin/governance");
  return results;
}

export async function triggerRuleEvaluation() {
  await requireAdmin();
  const results = await evaluateOpsRules();
  revalidatePath("/admin/governance");
  return results;
}

// ============================================
// AT-RISK DATA
// ============================================

export async function getAtRiskChapters() {
  const latestSnapshots = await prisma.chapterKpiSnapshot.findMany({
    where: { isAtRisk: true },
    orderBy: { snapshotDate: "desc" },
    distinct: ["chapterId"],
    include: {
      chapter: { select: { id: true, name: true, city: true, region: true } },
    },
    take: 50,
  });

  return latestSnapshots.map((s) => ({
    chapterId: s.chapterId,
    chapterName: s.chapter.name,
    city: s.chapter.city,
    region: s.chapter.region,
    snapshotDate: s.snapshotDate.toISOString(),
    riskFlags: s.riskFlags,
    activeStudents: s.activeStudents,
    activeInstructors: s.activeInstructors,
    pendingApplications: s.pendingApplications,
    overdueQueues: s.overdueQueues,
    classesRunningCount: s.classesRunningCount,
    enrollmentFillPercent: s.enrollmentFillPercent,
    mentorshipPairCount: s.mentorshipPairCount,
  }));
}

export async function getGovernanceDashboardData() {
  await requireAdmin();

  const [atRiskChapters, activeRules, recentViolations, totalChapters] = await Promise.all([
    getAtRiskChapters(),
    prisma.opsRule.count({ where: { status: "ACTIVE" } }),
    prisma.opsRuleViolation.count({
      where: {
        acknowledged: false,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.chapter.count(),
  ]);

  return {
    atRiskChapters,
    activeRules,
    recentViolations,
    totalChapters,
    healthyChapters: totalChapters - atRiskChapters.length,
  };
}

// ============================================
// OPS RULES CRUD
// ============================================

export async function getOpsRules() {
  await requireAdmin();
  const rules = await prisma.opsRule.findMany({
    orderBy: [{ status: "asc" }, { severity: "asc" }, { createdAt: "desc" }],
    include: {
      chapter: { select: { name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { violations: true } },
    },
  });

  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    severity: r.severity,
    status: r.status,
    metricKey: r.metricKey,
    operator: r.operator,
    thresholdValue: r.thresholdValue,
    chapterName: r.chapter?.name ?? "All Chapters",
    createdByName: r.createdBy.name,
    escalateToRoles: r.escalateToRoles,
    autoNotify: r.autoNotify,
    violationCount: r._count.violations,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createOpsRule(formData: FormData) {
  const session = await requireAdmin();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const severity = formData.get("severity") as string;
  const metricKey = formData.get("metricKey") as string;
  const operator = formData.get("operator") as string;
  const thresholdValue = parseFloat(formData.get("thresholdValue") as string);
  const chapterId = (formData.get("chapterId") as string) || null;
  const escalateToRoles = ((formData.get("escalateToRoles") as string) || "ADMIN")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  if (!name || !metricKey || !operator || isNaN(thresholdValue)) {
    throw new Error("Missing required fields");
  }

  await prisma.opsRule.create({
    data: {
      name,
      description: description || null,
      severity: severity as any,
      metricKey,
      operator,
      thresholdValue,
      chapterId,
      escalateToRoles,
      autoNotify: true,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/governance");
}

export async function toggleOpsRuleStatus(ruleId: string) {
  await requireAdmin();

  const rule = await prisma.opsRule.findUniqueOrThrow({ where: { id: ruleId } });
  const newStatus = rule.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

  await prisma.opsRule.update({
    where: { id: ruleId },
    data: { status: newStatus },
  });

  revalidatePath("/admin/governance");
}

export async function acknowledgeViolation(violationId: string) {
  const session = await requireAdmin();

  await prisma.opsRuleViolation.update({
    where: { id: violationId },
    data: {
      acknowledged: true,
      acknowledgedBy: session.user.id,
      acknowledgedAt: new Date(),
    },
  });

  revalidatePath("/admin/governance");
}

export async function getRecentViolations() {
  await requireAdmin();

  const violations = await prisma.opsRuleViolation.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      rule: { select: { name: true, severity: true, metricKey: true } },
      chapter: { select: { name: true } },
    },
  });

  return violations.map((v) => ({
    id: v.id,
    ruleName: v.rule.name,
    severity: v.rule.severity,
    metricKey: v.rule.metricKey,
    chapterName: v.chapter.name,
    actualValue: v.actualValue,
    thresholdValue: v.thresholdValue,
    acknowledged: v.acknowledged,
    createdAt: v.createdAt.toISOString(),
  }));
}

// ============================================
// ROLE MATRIX AUDIT
// ============================================

export async function getRoleMatrixData() {
  await requireAdmin();

  const chapters = await prisma.chapter.findMany({
    select: {
      id: true,
      name: true,
      city: true,
      region: true,
      users: {
        select: {
          roles: { select: { role: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const allRoles = ["ADMIN", "CHAPTER_PRESIDENT", "INSTRUCTOR", "MENTOR", "STUDENT", "STAFF", "PARENT"] as const;

  return chapters.map((ch) => {
    const roleCounts: Record<string, number> = {};
    for (const role of allRoles) {
      roleCounts[role] = 0;
    }
    for (const user of ch.users) {
      for (const ur of user.roles) {
        if (roleCounts[ur.role] !== undefined) {
          roleCounts[ur.role]++;
        }
      }
    }

    return {
      id: ch.id,
      name: ch.name,
      city: ch.city,
      region: ch.region,
      totalUsers: ch.users.length,
      roleCounts,
      hasLead: roleCounts.CHAPTER_PRESIDENT > 0,
      hasInstructor: roleCounts.INSTRUCTOR > 0,
    };
  });
}
