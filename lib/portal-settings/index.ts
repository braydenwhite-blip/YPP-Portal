// Portal-wide settings — READER (server-only).
//
// `getPortalSettings()` returns the fully-resolved, typed settings object:
// stored overrides merged OVER the hardcoded defaults. Wrapped in React `cache()`
// so the underlying `findMany` runs at most once per server request, no matter
// how many loaders call it. `withPrismaFallback` means a missing table or DB blip
// degrades to pure defaults instead of throwing (so this is safe to ship before
// the migration is applied).

import "server-only";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

import { type PortalSettings } from "./defaults";
import { mergePortalSettings } from "./merge";

export type { PortalSettings } from "./defaults";
export { PORTAL_SETTINGS_DEFAULTS } from "./defaults";

export const getPortalSettings = cache(async (): Promise<PortalSettings> => {
  const rows = await withPrismaFallback(
    "portal-settings:read",
    () => prisma.portalSetting.findMany({ select: { key: true, value: true } }),
    [] as Array<{ key: string; value: unknown }>
  );
  return mergePortalSettings(rows);
});
