"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { hasRole } from "@/lib/authorization-roles";
import { prisma } from "@/lib/prisma";
import { categoriesForScope, type MetricsScope } from "./catalog";
import {
  archiveFileOverride,
  createFileOverride,
  parseCatalogRowId,
  upsertFileOverride,
} from "./file-store";
import { ensureMetricsTrackerSeeded } from "./store";

export type MetricsMutationResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function requireAdmin() {
  const user = await requireSessionUser();
  if (!hasRole(user.roles, "ADMIN", user.primaryRole)) {
    throw new Error("Unauthorized");
  }
  return user;
}

const ScopeSchema = z.enum(["org", "chapter_president", "instructor"]);
const ResetSchema = z.enum(["monthly", "cumulative"]);
const UnitSchema = z.enum(["count", "percent", "currency", "hours", "text"]);
const ChartSchema = z.enum(["line", "bar", "area", "scatter"]);

const TargetsSchema = z
  .array(z.union([z.number().finite(), z.null()]))
  .length(6)
  .optional();

const TargetDisplaySchema = z
  .array(z.union([z.string(), z.null()]))
  .length(6)
  .optional();

const UpsertSchema = z.object({
  id: z.string().min(1).optional(),
  scope: ScopeSchema,
  categoryId: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(300),
  owner: z.string().trim().max(120).default(""),
  targetLabel: z.string().trim().max(300).default(""),
  reset: ResetSchema.default("monthly"),
  unit: UnitSchema.default("count"),
  chart: ChartSchema.default("line"),
  tracks: z.string().trim().max(1000).optional().nullable(),
  why: z.string().trim().max(1000).optional().nullable(),
  noTarget: z.boolean().default(false),
  monthlyTargets: TargetsSchema,
  targetDisplay: TargetDisplaySchema,
});

function defaultTargets(unit: string): Array<number | null> {
  if (unit === "percent") return [80, 80, 80, 80, 80, 80];
  return [0, 0, 0, 0, 0, 0];
}

function assertCategory(scope: MetricsScope, categoryId: string) {
  const cat = categoriesForScope(scope).find((c) => c.id === categoryId);
  if (!cat) throw new Error("Unknown category");
  return cat;
}

function mutationError(err: unknown, fallback: string): MetricsMutationResult {
  const message = err instanceof Error ? err.message : fallback;
  if (/unauthorized/i.test(message)) {
    return { ok: false, error: "Admins only." };
  }
  return { ok: false, error: message || fallback };
}

function metricsDb() {
  const client = prisma as unknown as {
    metricsTrackerMetric?: {
      findFirst: (args: unknown) => Promise<{ id: string; key?: string } | null>;
      update: (args: unknown) => Promise<unknown>;
      create: (args: unknown) => Promise<{ id: string }>;
      aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
    };
  };
  return client.metricsTrackerMetric ?? null;
}

async function upsertViaFile(
  data: z.infer<typeof UpsertSchema>,
  existingKey?: string
): Promise<MetricsMutationResult> {
  const monthlyTargets = data.noTarget
    ? [null, null, null, null, null, null]
    : (data.monthlyTargets ?? defaultTargets(data.unit));

  const patch = {
    label: data.label,
    owner: data.owner,
    targetLabel: data.targetLabel,
    reset: data.reset,
    unit: data.unit,
    chart: data.chart,
    tracks: data.tracks?.trim() ? data.tracks.trim() : null,
    why: data.why?.trim() ? data.why.trim() : null,
    noTarget: data.noTarget,
    monthlyTargets,
    targetDisplay: data.targetDisplay ?? null,
  };

  if (existingKey) {
    const id = await upsertFileOverride(data.scope, data.categoryId, existingKey, patch);
    revalidatePath("/admin/metrics");
    return { ok: true, id };
  }

  const key = `custom_${Date.now().toString(36)}`;
  const id = await createFileOverride(data.scope, data.categoryId, key, {
    label: data.label,
    owner: data.owner,
    targetLabel: data.targetLabel,
    monthlyTargets,
    targetDisplay: data.targetDisplay ?? null,
    reset: data.reset,
    unit: data.unit,
    chart: data.chart,
    tracks: patch.tracks,
    why: patch.why,
    noTarget: data.noTarget,
    sortOrder: 999,
  });
  revalidatePath("/admin/metrics");
  return { ok: true, id };
}

export async function upsertMetricsTrackerMetric(
  input: unknown
): Promise<MetricsMutationResult> {
  try {
    await requireAdmin();
    const data = UpsertSchema.parse(input);
    assertCategory(data.scope, data.categoryId);

    const monthlyTargets = data.noTarget
      ? [null, null, null, null, null, null]
      : (data.monthlyTargets ?? defaultTargets(data.unit));

    if (data.id?.startsWith("catalog:")) {
      const parsed = parseCatalogRowId(data.id);
      if (!parsed) return { ok: false, error: "Invalid metric id" };
      return upsertViaFile(data, parsed.key);
    }

    const db = metricsDb();
    const seeded = db ? await ensureMetricsTrackerSeeded() : false;

    if (!db || !seeded) {
      return upsertViaFile(data);
    }

    if (data.id) {
      const existing = await db.findFirst({
        where: { id: data.id, archivedAt: null },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "Metric not found" };

      const admin = await requireAdmin();
      await db.update({
        where: { id: data.id },
        data: {
          label: data.label,
          owner: data.owner,
          targetLabel: data.targetLabel,
          reset: data.reset,
          unit: data.unit,
          chart: data.chart,
          tracks: data.tracks?.trim() ? data.tracks.trim() : null,
          why: data.why?.trim() ? data.why.trim() : null,
          noTarget: data.noTarget,
          monthlyTargets,
          targetDisplay: data.targetDisplay ?? undefined,
          updatedById: admin.id,
        },
      });
      revalidatePath("/admin/metrics");
      return { ok: true, id: data.id };
    }

    const admin = await requireAdmin();
    const maxSort = await db.aggregate({
      where: { scope: data.scope, categoryId: data.categoryId, archivedAt: null },
      _max: { sortOrder: true },
    });
    const key = `custom_${Date.now().toString(36)}`;
    const created = await db.create({
      data: {
        key,
        scope: data.scope,
        categoryId: data.categoryId,
        label: data.label,
        owner: data.owner,
        targetLabel: data.targetLabel,
        reset: data.reset,
        unit: data.unit,
        chart: data.chart,
        tracks: data.tracks?.trim() ? data.tracks.trim() : null,
        why: data.why?.trim() ? data.why.trim() : null,
        noTarget: data.noTarget,
        monthlyTargets,
        targetDisplay: data.targetDisplay ?? undefined,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        updatedById: admin.id,
      },
      select: { id: true },
    });

    revalidatePath("/admin/metrics");
    return { ok: true, id: created.id };
  } catch (err) {
    return mutationError(err, "Couldn't save metric");
  }
}

export async function archiveMetricsTrackerMetric(
  input: unknown
): Promise<MetricsMutationResult> {
  try {
    await requireAdmin();
    const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid input" };

    if (parsed.data.id.startsWith("catalog:")) {
      const row = parseCatalogRowId(parsed.data.id);
      if (!row) return { ok: false, error: "Invalid metric id" };
      await archiveFileOverride(row.scope, row.categoryId, row.key);
      revalidatePath("/admin/metrics");
      return { ok: true, id: parsed.data.id };
    }

    const db = metricsDb();
    if (!db) {
      return { ok: false, error: "Metric not found" };
    }

    const row = await db.findFirst({
      where: { id: parsed.data.id, archivedAt: null },
      select: { id: true },
    });
    if (!row) return { ok: false, error: "Metric not found" };

    await db.update({
      where: { id: row.id },
      data: { archivedAt: new Date() },
    });
    revalidatePath("/admin/metrics");
    return { ok: true, id: row.id };
  } catch (err) {
    return mutationError(err, "Couldn't remove metric");
  }
}
