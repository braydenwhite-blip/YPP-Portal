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
import { loadMentorshipSnapshot } from "@/lib/data-360/mentorship-analytics";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import { getDatabaseAnalytics } from "@/lib/operations/database-analytics";
import { getGoogleSheetsAnalytics } from "@/lib/operations/google-sheets-analytics";

import { Data360Shell } from "./data-360-shell";
import { AnalyticsDashboard } from "@/components/operations/analytics-dashboard";

/**
 * Data 360 — YPP's organizational intelligence surface.
 *
 * Leadership-gated (`requireLeadership`): Officer-tier and above on the org
 * ladder, or ADMIN with the Leadership/Super-Admin subtype. Distinct from the
 * operational `/operations/data-360` ("Connected data") work surface — this is
 * the quantitative, score-free, drill-down-first intelligence layer.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Org intelligence — Pathways Portal" };

export default async function Data360Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Allow demo mode access without authentication
  const isDemoMode = isHiringDemoModeEnabled();
  const viewer = isDemoMode 
    ? { id: "demo", roles: ["ADMIN"], primaryRole: "ADMIN", adminSubtypes: ["SUPER_ADMIN"], internalLevel: 7 }
    : await requireLeadership().catch(() => null);
  
  if (!viewer) {
    if (isDemoMode) {
      throw new Error("Demo mode misconfigured");
    }
    redirect("/");
  }

  const sp = await searchParams;
  const rangeKey = parseRangeKey(typeof sp.range === "string" ? sp.range : undefined);
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;

  const now = new Date();
  const range = resolveRange(rangeKey, now);

  // Load critical data first, then non-critical analytics
  const [overview, attentionFacts, workflow, mentorship, dbAnalytics] = await Promise.all([
    loadData360Overview(range, now),
    loadNeedsAttention(now),
    loadWorkflowIntelligence(now),
    loadMentorshipSnapshot(now),
    getDatabaseAnalytics(),
  ]);
  
  // Fire-and-forget Google Sheets (non-blocking, will show "not configured" if API key missing)
  const sheetsAnalyticsPromise = getGoogleSheetsAnalytics();
  const sheetsAnalytics = await sheetsAnalyticsPromise;
  const attention = groupAttention(attentionFacts);
  const lens = defaultLensForRole(viewer.primaryRole, viewer.internalLevel);

  // Prepare analytics data for the dashboard
  const analyticsData = {
    snapshot: (overview?.kpis || []).map((kpi) => ({
      key: kpi.key,
      label: kpi.label,
      value: kpi.value || 0,
      tone: kpi.tone,
      hint: kpi.hint,
    })),
    attention: attention.map((item) => ({
      category: item.label,
      count: item.facts?.length || 0,
    })),
    board: workflow?.overview || {},
    initiatives: [],
    dbAnalytics,
    sheetsAnalytics,
  };

  return (
    <>
      {/* Analytics Dashboard with Collapsible Sections */}
      <AnalyticsDashboard data={analyticsData} />
      
      <Data360Shell
        overview={overview}
        attention={attention}
        workflow={workflow}
        mentorship={mentorship}
        defaultLens={lens}
        rangeKey={rangeKey}
        initialTab={initialTab}
      />
    </>
  );
}
