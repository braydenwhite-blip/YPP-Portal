import { cache } from "react";
import { checkAndAutoUnlockAndGetSections } from "@/lib/unlock-manager";

/**
 * Runs auto-unlock once per request, then returns fresh unlocked sections.
 * Call this instead of separate checkAndAutoUnlock + getUnlockedSections in layout + dashboard.
 */
export const ensureAutoUnlockAndGetSections = cache(async (userId: string) => {
  const result = await checkAndAutoUnlockAndGetSections(userId).catch(
    () => ({ unlockedSections: new Set<string>() })
  );
  return result.unlockedSections;
});
