import { redirect } from "next/navigation";

import { requireLeadership } from "@/lib/authorization";
import {
  defaultLensForRole,
  groupAttention,
  loadData360Overview,
  loadNeedsAttention,
  parseRangeKey,
  resolveRange,
} from "@/lib/data-360";
import { loadWorkflowIntelligence } from "@/lib/data-360/workflow-intelligence";

import { Data360Shell } from "./data-360-shell";

/**
 * Data 360 — YPP's organizational intelligence surface.
 *
 * Leadership-gated (`requireLeadership`): Officer-tier and above on the org
 * ladder, or ADMIN with the Leadership/Super-Admin subtype. Distinct from the
 * operational `/operations/data-360` ("Connected data") work surface — this is
 * the quantitative, score-free, drill-down-first intelligence layer.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Data 360 — Pathways Portal" };

export default async function Data360Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) redirect("/");

  const sp = await searchParams;
  const rangeKey = parseRangeKey(typeof sp.range === "string" ? sp.range : undefined);
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;

  const now = new Date();
  const range = resolveRange(rangeKey, now);

  const [overview, attentionFacts, workflow] = await Promise.all([
    loadData360Overview(range, now),
    loadNeedsAttention(now),
    loadWorkflowIntelligence(now),
  ]);
  const attention = groupAttention(attentionFacts);
  const lens = defaultLensForRole(viewer.primaryRole, viewer.internalLevel);

  return (
    <Data360Shell
      overview={overview}
      attention={attention}
      workflow={workflow}
      defaultLens={lens}
      rangeKey={rangeKey}
      initialTab={initialTab}
    />
  );
}
