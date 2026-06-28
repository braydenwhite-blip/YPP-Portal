"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authorization-helpers";

import { PortalSettingsPatchSchema } from "./schema";

export type UpdatePortalSettingsResult = { ok: true } | { ok: false; error: string };

/**
 * Persist a partial settings patch. Each provided top-level group is upserted as
 * one JSON row (keyed by the group name). Unset keys keep falling back to defaults
 * via `getPortalSettings()`, so the form only needs to send what it edited.
 */
export async function updatePortalSettings(input: unknown): Promise<UpdatePortalSettingsResult> {
  const viewer = await requireAdmin().catch(() => null);
  if (!viewer) {
    return { ok: false, error: "Only an administrator can change portal settings." };
  }

  const parsed = PortalSettingsPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some values were invalid. Please check the highlighted fields." };
  }

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    await prisma.portalSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: viewer.id },
      update: { value: value as Prisma.InputJsonValue, updatedById: viewer.id },
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/chapter/operating");
  return { ok: true };
}
