/**
 * Partner logistics readiness checklist (Partner Automation, Phase 1).
 *
 * Confirmed partners aren't "launch-ready" until the on-the-ground logistics are
 * nailed down. The checklist state lives in `Partner.logistics` (JSON map of
 * item-key → boolean). This module owns the canonical item list, safe parsing,
 * and readiness derivation. Pure + testable.
 */

import { asPartnerStage } from "@/lib/partners-constants";

// A const tuple so `z.enum(LOGISTICS_KEYS)` keeps the precise union (not `string`).
export const LOGISTICS_KEYS = [
  "room",
  "dayTime",
  "launchDate",
  "pointOfContact",
  "supervision",
  "writtenConfirmation",
  "scheduleConnected",
  "publicListing",
  "emergencyContacts",
] as const;

export type LogisticsKey = (typeof LOGISTICS_KEYS)[number];

export const LOGISTICS_LABELS: Record<LogisticsKey, string> = {
  room: "Room / space confirmed",
  dayTime: "Day(s) and time confirmed",
  launchDate: "Launch date confirmed",
  pointOfContact: "On-site point of contact confirmed",
  supervision: "Supervision arrangement confirmed",
  writtenConfirmation: "Written confirmation received",
  scheduleConnected: "Class schedule connected",
  publicListing: "Public class listing ready",
  emergencyContacts: "Emergency / contact instructions confirmed",
};

export const LOGISTICS_ITEMS = LOGISTICS_KEYS.map((key) => ({ key, label: LOGISTICS_LABELS[key] }));

export type PartnerLogistics = Partial<Record<LogisticsKey, boolean>>;

/** Stages where logistics readiness is meaningful (partner is confirmed/active). */
const LOGISTICS_RELEVANT_STAGES = new Set(["ACTIVE_PARTNERSHIP", "COMPLETED"]);

export function isLogisticsRelevant(stage: string | null | undefined): boolean {
  return LOGISTICS_RELEVANT_STAGES.has(asPartnerStage(stage));
}

/**
 * Coerce an unknown JSON value (from `Partner.logistics`) into a clean
 * PartnerLogistics map — only known keys, only boolean values. Garbage / null
 * yields an empty map (everything defaults to not-done).
 */
export function parseLogistics(value: unknown): PartnerLogistics {
  const out: PartnerLogistics = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  const rec = value as Record<string, unknown>;
  for (const key of LOGISTICS_KEYS) {
    if (rec[key] === true) out[key] = true;
    else if (rec[key] === false) out[key] = false;
  }
  return out;
}

export type LogisticsReadiness = {
  items: Array<{ key: LogisticsKey; label: string; done: boolean }>;
  total: number;
  complete: number;
  remaining: LogisticsKey[];
  isComplete: boolean;
  percent: number;
};

export function logisticsReadiness(logistics: PartnerLogistics): LogisticsReadiness {
  const items = LOGISTICS_ITEMS.map((i) => ({ key: i.key, label: i.label, done: logistics[i.key] === true }));
  const complete = items.filter((i) => i.done).length;
  const total = items.length;
  const remaining = items.filter((i) => !i.done).map((i) => i.key);
  return {
    items,
    total,
    complete,
    remaining,
    isComplete: complete === total,
    percent: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}

/** True when logistics are fully checked off (or n/a for an unconfirmed partner). */
export function isLogisticsComplete(value: unknown): boolean {
  return logisticsReadiness(parseLogistics(value)).isComplete;
}

/**
 * "Confirmed but logistics incomplete" — the prominent state the workspace
 * surfaces. Only meaningful for confirmed/active partners.
 */
export function isLogisticsIncomplete(stage: string | null | undefined, value: unknown): boolean {
  if (!isLogisticsRelevant(stage)) return false;
  return !logisticsReadiness(parseLogistics(value)).isComplete;
}

/** Merge a single item toggle into an existing logistics map (immutably). */
export function withLogisticsItem(
  value: unknown,
  key: LogisticsKey,
  done: boolean
): PartnerLogistics {
  return { ...parseLogistics(value), [key]: done };
}
