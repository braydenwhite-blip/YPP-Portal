import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  isActionTrackerEnabled,
  isPartnerPipelineEnabled,
} from "@/lib/feature-flags";
import { listPartners } from "@/lib/partners-queries";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";
import {
  PARTNER_PRIORITIES,
  PARTNER_PRIORITY_LABELS,
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  asPartnerStage,
  isActivePartnerStage,
  partnerStuckReasons,
  summarizePartnerPipeline,
} from "@/lib/partners-constants";
import { StatCard } from "@/components/people-strategy/stat-card";
import { Pill } from "@/components/people-strategy/pills";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partnership Report · Admin" };

/**
 * Phase 8 — Partnership Report. Read-only roll-up of the partner pipeline
 * (counts by stage + priority, won/active/parked, and the partners going cold)
 * reusing the Phase 4 queries + stuck-detection. Admin-only; returns notFound()
 * when the pipeline flag is off so the route's existence is not leaked.
 */
export default async function PartnershipReportPage() {
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) redirect("/");
  if (!isPartnerPipelineEnabled()) notFound();

  const now = new Date();
  const partners = await listPartners();

  const trackerEnabled = isActionTrackerEnabled();
  const openActionCounts = trackerEnabled
    ? await countOpenActionsByRelatedEntity("PARTNER", partners.map((p) => p.id))
    : new Map<string, number>();

  const summary = summarizePartnerPipeline(partners, now);
  const totalOpenActions = Array.from(openActionCounts.values()).reduce((a, b) => a + b, 0);

  // Per-stage open-action totals, so each stage row shows live next-step volume.
  const openActionsByStage = new Map<string, number>();
  for (const p of partners) {
    const stage = asPartnerStage(p.stage);
    openActionsByStage.set(stage, (openActionsByStage.get(stage) ?? 0) + (openActionCounts.get(p.id) ?? 0));
  }

  const stuckPartners = partners
    .filter((p) => isActivePartnerStage(asPartnerStage(p.stage)) && partnerStuckReasons(p, now).length > 0)
    .sort((a, b) => (openActionCounts.get(b.id) ?? 0) - (openActionCounts.get(a.id) ?? 0));

  const stagesWithPartners = PARTNER_STAGES.filter((s) => summary.byStage[s] > 0);

  return (
    <div className="page-shell" style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="badge">Admin · Partnerships</p>
          <h1 className="page-title" style={{ margin: "6px 0 0" }}>Partnership Report</h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            Where the pipeline stands — active conversations, wins, and partners going cold.
          </p>
        </div>
        <Link href="/admin/partners" className="button outline small">
          ← Pipeline board
        </Link>
      </div>

      {/* Headline */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
        <StatCard label="Total partners" value={summary.total} icon="users" />
        <StatCard label="Active pipeline" value={summary.active} icon="activity" tone="accent" />
        <StatCard label="Won" value={summary.won} icon="check" tone="success" />
        <StatCard
          label="Needs attention"
          value={summary.stuck}
          icon="alert"
          tone={summary.stuck > 0 ? "warning" : "default"}
        />
        {trackerEnabled ? (
          <StatCard label="Open follow-up actions" value={totalOpenActions} icon="list" />
        ) : null}
      </div>

      {/* By stage */}
      <section style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="ps-section-title">Partners by stage</h2>
        {stagesWithPartners.length === 0 ? (
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
            No partners yet. Add the first one on the pipeline board.
          </div>
        ) : (
          <div className="card" style={{ padding: "8px 0" }}>
            {stagesWithPartners.map((stage) => (
              <div
                key={stage}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 14px",
                }}
              >
                <Link href={`/admin/partners?stage=${stage}`} style={{ fontSize: 13, fontWeight: 600, color: "inherit" }}>
                  {PARTNER_STAGE_LABELS[stage]}
                </Link>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {summary.byStage[stage]} {summary.byStage[stage] === 1 ? "partner" : "partners"}
                  {trackerEnabled && (openActionsByStage.get(stage) ?? 0) > 0
                    ? ` · ${openActionsByStage.get(stage)} open ${openActionsByStage.get(stage) === 1 ? "action" : "actions"}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* By priority */}
      <section style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="ps-section-title">By priority</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {PARTNER_PRIORITIES.map((priority) => (
            <StatCard
              key={priority}
              label={PARTNER_PRIORITY_LABELS[priority]}
              value={summary.byPriority[priority]}
            />
          ))}
        </div>
      </section>

      {/* Needs attention */}
      <section style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 className="ps-section-title">Partners needing attention</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {stuckPartners.length} {stuckPartners.length === 1 ? "partner" : "partners"}
          </span>
        </div>
        {stuckPartners.length === 0 ? (
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
            Every active partner has an owner and a next step. 🎉
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stuckPartners.map((p) => (
              <div key={p.id} className="card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <Link href={`/admin/partners/${p.id}`} style={{ fontSize: 14, fontWeight: 600, color: "inherit" }}>
                    {p.name}
                  </Link>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {partnerStuckReasons(p, now).map((reason) => (
                      <Pill key={reason} tone="warning">{reason}</Pill>
                    ))}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
                  {PARTNER_STAGE_LABELS[asPartnerStage(p.stage)]}
                  {` · Lead: ${p.relationshipLead?.name ?? p.relationshipLead?.email ?? "unassigned"}`}
                  {trackerEnabled ? ` · ${openActionCounts.get(p.id) ?? 0} open actions` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
