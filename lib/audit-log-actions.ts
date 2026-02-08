"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { AuditAction } from "@prisma/client";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ============================================
// LOG AN AUDIT EVENT (internal helper)
// ============================================

export async function logAuditEvent({
  action,
  actorId,
  targetType,
  targetId,
  description,
  metadata,
}: {
  action: AuditAction;
  actorId: string;
  targetType?: string;
  targetId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      action,
      actorId,
      targetType: targetType || null,
      targetId: targetId || null,
      description,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

// ============================================
// GET AUDIT LOGS (Admin)
// ============================================

export async function getAuditLogs(filters?: {
  action?: string;
  actorId?: string;
  targetType?: string;
  search?: string;
  page?: number;
  perPage?: number;
}) {
  await requireAdmin();

  const page = filters?.page || 1;
  const perPage = filters?.perPage || 50;
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = {};

  if (filters?.action) {
    where.action = filters.action;
  }
  if (filters?.actorId) {
    where.actorId = filters.actorId;
  }
  if (filters?.targetType) {
    where.targetType = filters.targetType;
  }
  if (filters?.search) {
    where.description = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ============================================
// GET AUDIT LOG STATS
// ============================================

export async function getAuditLogStats() {
  await requireAdmin();

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, last24hCount, last7dCount, byAction] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  return {
    total,
    last24hCount,
    last7dCount,
    topActions: byAction.map((a) => ({
      action: a.action,
      count: a._count.id,
    })),
  };
}
