import { redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import {
  listPartners,
  listRelationshipLeadOptions,
  type PartnerListItem,
} from "@/lib/partners-queries";
import {
  createPartner,
  updatePartner,
  archivePartner,
} from "@/lib/partners-actions";
import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import {
  isActionTrackerEnabled,
  isPartnerPipelineEnabled,
} from "@/lib/feature-flags";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";
import {
  PARTNER_STAGES,
  PARTNER_PRIORITIES,
  PARTNER_TYPES,
  PARTNER_STAGE_LABELS,
  PARTNER_PRIORITY_LABELS,
  PARTNER_TYPE_LABELS,
  PARTNER_STAGE_HINTS,
  partnerPriorityLabel,
  partnerTypeLabel,
  partnerStuckReasons,
  asPartnerStage,
  isActivePartnerStage,
  type PartnerStage,
} from "@/lib/partners-constants";
import { StageSelect } from "./stage-select";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners · Admin" };

type LeadOption = { id: string; name: string | null; email: string };

function LeadSelect({
  leads,
  selectedId,
}: {
  leads: LeadOption[];
  selectedId?: string | null;
}) {
  return (
    <select name="relationshipLeadId" className="input" defaultValue={selectedId ?? ""}>
      <option value="">— No Relationship Lead —</option>
      {leads.map((lead) => (
        <option key={lead.id} value={lead.id}>
          {lead.name || lead.email}
        </option>
      ))}
    </select>
  );
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) {
    redirect("/");
  }

  const [partners, leads] = await Promise.all([
    listPartners(),
    listRelationshipLeadOptions(),
  ]);

  // Per-partner count of open linked actions, so a relationship lead can see at
  // a glance which partners have a live next step and which are going cold.
  const trackerEnabled = isActionTrackerEnabled();
  const openActionCounts = trackerEnabled
    ? await countOpenActionsByRelatedEntity(
        "PARTNER",
        partners.map((p) => p.id)
      )
    : new Map<string, number>();

  // --- Flag OFF: preserve the original simple directory exactly -------------
  if (!isPartnerPipelineEnabled()) {
    return (
      <div className="page-shell" style={{ maxWidth: 980 }}>
        <p className="badge">Admin</p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          Partners
        </h1>
        <p className="page-subtitle">
          Organizations and schools behind your classes. Each partner carries a
          Relationship Lead and can be attached to class offerings from the class
          detail page.
        </p>

        {/* Create */}
        <div className="card" style={{ marginTop: 16, padding: "16px 18px" }}>
          <div className="section-title">Add a partner</div>
          <form action={createPartner} className="form-grid" style={{ marginTop: 8 }}>
            <div className="form-row">
              <label>Name *</label>
              <input type="text" name="name" className="input" required maxLength={160} />
            </div>
            <div className="form-row">
              <label>Type</label>
              <input
                type="text"
                name="type"
                className="input"
                placeholder="School, Nonprofit, Corporate…"
                maxLength={80}
              />
            </div>
            <div className="form-row">
              <label>Website</label>
              <input type="url" name="website" className="input" placeholder="https://…" />
            </div>
            <div className="form-row">
              <label>Relationship Lead</label>
              <LeadSelect leads={leads} />
            </div>
            <div className="form-row">
              <label>Notes</label>
              <textarea name="notes" className="input" rows={2} />
            </div>
            <button type="submit" className="button">
              Add Partner
            </button>
          </form>
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
          {partners.length === 0 ? (
            <div className="card" style={{ padding: 16 }}>
              <p style={{ margin: 0 }}>No partners yet. Add your first one above.</p>
            </div>
          ) : (
            partners.map((partner: PartnerListItem) => (
              <div key={partner.id} className="card" style={{ padding: "14px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <EntityLink
                      type="partner"
                      id={partner.id}
                      style={{ fontSize: 15, fontWeight: 700, color: "inherit" }}
                    >
                      {partner.name}
                    </EntityLink>
                    {partner.type ? (
                      <span className="badge" style={{ marginLeft: 8, fontSize: 11 }}>
                        {partner.type}
                      </span>
                    ) : null}
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                      Relationship Lead:{" "}
                      {partner.relationshipLead ? (
                        <PersonLink id={partner.relationshipLead.id} style={{ color: "inherit", fontWeight: 600 }}>
                          {partner.relationshipLead.name || partner.relationshipLead.email}
                        </PersonLink>
                      ) : (
                        "Unassigned"
                      )}
                      {" · "}
                      {partner._count.classOfferings}{" "}
                      {partner._count.classOfferings === 1 ? "class" : "classes"}
                      {partner.website ? (
                        <>
                          {" · "}
                          <Link href={partner.website} style={{ color: "var(--ypp-purple)" }}>
                            Website
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {trackerEnabled ? (
                      <p
                        style={{
                          margin: "8px 0 0",
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Link
                          href={`/actions/new?relatedType=PARTNER&relatedId=${partner.id}`}
                          className="button outline small"
                        >
                          + Create action
                        </Link>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {(openActionCounts.get(partner.id) ?? 0) > 0
                            ? `${openActionCounts.get(partner.id)} open ${
                                openActionCounts.get(partner.id) === 1 ? "action" : "actions"
                              }`
                            : "No open actions — add a follow-up so this partner doesn't go cold."}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Edit / archive */}
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--ypp-purple)" }}>
                    Edit
                  </summary>
                  <form action={updatePartner} className="form-grid" style={{ marginTop: 10 }}>
                    <input type="hidden" name="id" value={partner.id} />
                    <div className="form-row">
                      <label>Name *</label>
                      <input
                        type="text"
                        name="name"
                        className="input"
                        defaultValue={partner.name}
                        required
                        maxLength={160}
                      />
                    </div>
                    <div className="form-row">
                      <label>Type</label>
                      <input
                        type="text"
                        name="type"
                        className="input"
                        defaultValue={partner.type ?? ""}
                        maxLength={80}
                      />
                    </div>
                    <div className="form-row">
                      <label>Website</label>
                      <input type="url" name="website" className="input" defaultValue={partner.website ?? ""} />
                    </div>
                    <div className="form-row">
                      <label>Relationship Lead</label>
                      <LeadSelect leads={leads} selectedId={partner.relationshipLead?.id ?? null} />
                    </div>
                    <div className="form-row">
                      <label>Notes</label>
                      <textarea name="notes" className="input" rows={2} defaultValue={partner.notes ?? ""} />
                    </div>
                    <button type="submit" className="button">
                      Save Changes
                    </button>
                  </form>
                  <form action={archivePartner} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={partner.id} />
                    <button
                      type="submit"
                      className="button"
                      style={{ background: "transparent", color: "#b91c1c", border: "1px solid #fecaca" }}
                    >
                      Archive Partner
                    </button>
                  </form>
                </details>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // --- Flag ON: Partner Pipeline -------------------------------------------
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "all";
  const now = new Date();

  type Decorated = PartnerListItem & {
    stageValue: PartnerStage;
    stuck: string[];
    openActions: number;
  };
  const decorated: Decorated[] = partners.map((p) => ({
    ...p,
    stageValue: asPartnerStage(p.stage),
    stuck: partnerStuckReasons(
      { stage: p.stage, nextFollowUpAt: p.nextFollowUpAt, relationshipLeadId: p.relationshipLeadId },
      now
    ),
    openActions: openActionCounts.get(p.id) ?? 0,
  }));

  const isFollowUp = (p: Decorated) => p.stuck.length > 0;
  const isMeeting = (p: Decorated) => p.stageValue === "MEETING_SCHEDULED";
  const isProposal = (p: Decorated) =>
    p.stageValue === "NEEDS_PROPOSAL" || p.stageValue === "PROPOSAL_SENT";
  const isActiveP = (p: Decorated) => p.stageValue === "ACTIVE_PARTNERSHIP";
  const isCamp = (p: Decorated) => p.partnerType === "CAMP";
  const isParked = (p: Decorated) =>
    p.stageValue === "PAUSED" || p.stageValue === "NOT_A_FIT";

  const tabs: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All partners", count: decorated.length },
    { key: "follow-up", label: "Needs follow-up", count: decorated.filter(isFollowUp).length },
    { key: "meetings", label: "Meetings", count: decorated.filter(isMeeting).length },
    { key: "proposal", label: "Proposals", count: decorated.filter(isProposal).length },
    { key: "active", label: "Active partnerships", count: decorated.filter(isActiveP).length },
    { key: "camps", label: "Camps", count: decorated.filter(isCamp).length },
    { key: "parked", label: "Parked", count: decorated.filter(isParked).length },
  ];

  const filtered =
    view === "follow-up"
      ? decorated.filter(isFollowUp)
      : view === "meetings"
      ? decorated.filter(isMeeting)
      : view === "proposal"
      ? decorated.filter(isProposal)
      : view === "active"
      ? decorated.filter(isActiveP)
      : view === "camps"
      ? decorated.filter(isCamp)
      : view === "parked"
      ? decorated.filter(isParked)
      : decorated;

  // Snapshot metrics across the whole pipeline.
  const snapshot = [
    { label: "Active conversations", value: decorated.filter((p) => isActivePartnerStage(p.stageValue)).length },
    { label: "Needs follow-up", value: decorated.filter(isFollowUp).length },
    { label: "Meetings scheduled", value: decorated.filter(isMeeting).length },
    { label: "Proposals out", value: decorated.filter(isProposal).length },
    { label: "Active partnerships", value: decorated.filter(isActiveP).length },
  ];

  function PartnerCard({ p }: { p: Decorated }) {
    return (
      <div className="card" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <EntityLink
                type="partner"
                id={p.id}
                style={{ fontSize: 15, fontWeight: 700, color: "var(--ypp-purple)" }}
              >
                {p.name}
              </EntityLink>
              {partnerTypeLabel(p.partnerType) ? (
                <span className="badge" style={{ fontSize: 11 }}>{partnerTypeLabel(p.partnerType)}</span>
              ) : p.type ? (
                <span className="badge" style={{ fontSize: 11 }}>{p.type}</span>
              ) : null}
              <span className="badge" style={{ fontSize: 11 }}>{partnerPriorityLabel(p.priority)}</span>
            </div>

            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
              Lead:{" "}
              {p.relationshipLead ? (
                <PersonLink id={p.relationshipLead.id} style={{ color: "inherit", fontWeight: 600 }}>
                  {p.relationshipLead.name || p.relationshipLead.email}
                </PersonLink>
              ) : (
                "Unassigned"
              )}
              {" · Next follow-up: "}
              <strong style={{ color: p.stuck.includes("Follow-up is overdue") ? "#b91c1c" : "inherit" }}>
                {formatDate(p.nextFollowUpAt)}
              </strong>
            </p>

            {p.stuck.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {p.stuck.map((reason) => (
                  <span
                    key={reason}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#b91c1c",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}

            {trackerEnabled ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {p.openActions > 0
                  ? `${p.openActions} open ${p.openActions === 1 ? "action" : "actions"}`
                  : "No open actions yet."}
                {" · "}
                <Link href={`/actions/new?relatedType=PARTNER&relatedId=${p.id}`} style={{ color: "var(--ypp-purple)" }}>
                  + Create action
                </Link>
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <StageSelect partnerId={p.id} stage={p.stage} />
            <Link href={`/admin/partners/${p.id}`} className="button outline small">
              Open profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty-state copy per view — always tells the admin what to do next.
  const emptyCopy: Record<string, string> = {
    all: "No partners yet. Add your first organization above to start the pipeline.",
    "follow-up": "Nothing is stuck. Every active conversation has an owner and a next step.",
    meetings: "No meetings scheduled. Move a partner to “Meeting scheduled” once a time is set.",
    proposal: "No proposals in flight. Move a partner to “Needs proposal” when they're ready.",
    active: "No active partnerships yet. They'll appear here once a deal goes live.",
    camps: "No camps tracked yet. Set a partner's type to “Camp” to see them here.",
    parked: "Nothing parked. Paused and not-a-fit partners land here.",
  };

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="badge">Admin · Growth</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Partner Pipeline
          </h1>
          <p className="page-subtitle">
            Every camp, school, and organization conversation in one place — who owns it,
            what stage it&apos;s at, and the next step so nothing goes cold.
          </p>
        </div>
        <Link href="/admin/partners/report" className="button outline small" style={{ marginTop: 8 }}>
          View report
        </Link>
      </div>

      {/* Snapshot */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        {snapshot.map((s) => (
          <div key={s.label} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ypp-purple)" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add partner */}
      <details className="card" style={{ marginTop: 16, padding: "14px 16px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>+ Add a partner</summary>
        <form action={createPartner} className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-row">
            <label>Name *</label>
            <input type="text" name="name" className="input" required maxLength={160} />
          </div>
          <div className="form-row">
            <label>Type</label>
            <select name="partnerType" className="input" defaultValue="">
              <option value="">— Select type —</option>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Stage</label>
            <select name="stage" className="input" defaultValue="NOT_STARTED">
              {PARTNER_STAGES.map((s) => (
                <option key={s} value={s}>{PARTNER_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Priority</label>
            <select name="priority" className="input" defaultValue="MEDIUM">
              {PARTNER_PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>{PARTNER_PRIORITY_LABELS[pr]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Relationship Lead</label>
            <LeadSelect leads={leads} />
          </div>
          <div className="form-row">
            <label>Website</label>
            <input type="url" name="website" className="input" placeholder="https://…" />
          </div>
          <button type="submit" className="button">Add Partner</button>
        </form>
      </details>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0 6px" }}>
        {tabs.map((t) => {
          const activeTab = t.key === view;
          return (
            <Link
              key={t.key}
              href={t.key === "all" ? "/admin/partners" : `/admin/partners?view=${t.key}`}
              className="badge"
              style={{
                fontSize: 12,
                padding: "6px 12px",
                background: activeTab ? "var(--ypp-purple)" : undefined,
                color: activeTab ? "#fff" : undefined,
                fontWeight: activeTab ? 700 : 500,
              }}
            >
              {t.label} ({t.count})
            </Link>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 18, marginTop: 8 }}>
          <p style={{ margin: 0, color: "var(--muted)" }}>{emptyCopy[view] ?? emptyCopy.all}</p>
        </div>
      ) : view === "all" ? (
        // Grouped by stage in pipeline order.
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 8 }}>
          {PARTNER_STAGES.map((stage) => {
            const inStage = filtered.filter((p) => p.stageValue === stage);
            if (inStage.length === 0) return null;
            return (
              <section key={stage}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 15, margin: 0 }}>{PARTNER_STAGE_LABELS[stage]}</h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {inStage.length} · {PARTNER_STAGE_HINTS[stage]}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {inStage.map((p) => (
                    <PartnerCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {filtered.map((p) => (
            <PartnerCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
