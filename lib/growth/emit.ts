/**
 * Student Operating System / Growth Engine (Phase N1) — the event ingress.
 *
 * `emitGrowthEvent` is the ONE door future systems use to feed the Growth
 * Engine. It is:
 *   - a no-op unless ENABLE_GROWTH_OS (so emitters can be wired everywhere and
 *     shipped dark with zero behavior change),
 *   - idempotent (persists on (userId, dedupeKey); default key = "<type>:<sourceId>"),
 *   - best-effort (try/catch — a growth-tracking failure never breaks the caller),
 *   - self-healing (each emit triggers an idempotent recompute of achievements,
 *     opportunities, and profile counters).
 *
 * Mirrors the existing onProgressEvent contract in lib/progress-events.ts.
 */

import { prisma } from "@/lib/prisma";
import { isGrowthOsEnabled } from "@/lib/feature-flags";
import type { GrowthTrackId } from "./constants";
import {
  getGrowthEventDefinition,
  isGrowthEventType,
  type GrowthEventType,
} from "./events";
import { recomputeGrowthForUser } from "./recompute";

export interface EmitGrowthEventInput {
  userId: string;
  type: GrowthEventType;
  /** Overrides the registry default title for the timeline. */
  title?: string;
  description?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  /** Explicit idempotency key; defaults to "<type>:<sourceId>" when sourceId is set. */
  dedupeKey?: string | null;
  track?: GrowthTrackId;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}

export interface EmitGrowthEventResult {
  recorded: boolean;
  eventId?: string;
  /** Achievement keys the user holds after this event (when recorded). */
  earnedAchievementKeys?: string[];
}

/**
 * Record a growth event and fold it forward. Returns `{ recorded: false }` (never
 * throws) when the flag is off, the type is unknown, the userId is missing, or
 * anything errors.
 */
export async function emitGrowthEvent(
  input: EmitGrowthEventInput
): Promise<EmitGrowthEventResult> {
  if (!isGrowthOsEnabled()) return { recorded: false };
  if (!input.userId || !isGrowthEventType(input.type)) return { recorded: false };

  try {
    const def = getGrowthEventDefinition(input.type);
    const dedupeKey =
      input.dedupeKey ?? (input.sourceId ? `${input.type}:${input.sourceId}` : null);

    const data = {
      userId: input.userId,
      type: input.type,
      track: input.track ?? def.track,
      title: input.title?.trim() || def.defaultTitle,
      description: input.description ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      metadata: (input.metadata ?? undefined) as object | undefined,
      occurredAt: input.occurredAt ?? new Date(),
    };

    // Idempotent when a dedupeKey is present; otherwise always insert.
    const event = dedupeKey
      ? await prisma.growthProgressEvent.upsert({
          where: { userId_dedupeKey: { userId: input.userId, dedupeKey } },
          create: { ...data, dedupeKey },
          update: {},
        })
      : await prisma.growthProgressEvent.create({ data });

    const result = await recomputeGrowthForUser(input.userId);
    return {
      recorded: true,
      eventId: event.id,
      earnedAchievementKeys: result.earnedAchievementKeys,
    };
  } catch (error) {
    console.error("[emitGrowthEvent] error:", error);
    return { recorded: false };
  }
}
