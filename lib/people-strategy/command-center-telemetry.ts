"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";

import type { CommandCenterEventName } from "./command-center-events";

/**
 * People Strategy — record a Command Center adoption event (Phase 6 #4).
 *
 * A deliberately lightweight server action: it resolves the viewer from the
 * session (no caller-supplied identity to trust), writes a single
 * `AnalyticsEvent`, and is best-effort — any failure is swallowed so a telemetry
 * write can never break the leader's interaction. Fired fire-and-forget from the
 * client controls (briefing copy, attention-item open).
 */
export async function recordCommandCenterEvent(
  eventType: CommandCenterEventName,
  eventData?: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return;
    await prisma.analyticsEvent.create({
      data: {
        userId: session.user.id,
        eventType,
        eventData: eventData ?? undefined,
      },
    });
  } catch {
    // Telemetry is best-effort; never surface a failure to the user.
  }
}
