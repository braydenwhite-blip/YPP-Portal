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
import { PersonLink } from "@/components/people-strategy/person-link";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { countOpenActionsByRelatedEntity } from "@/lib/people-strategy/action-queries";

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

export default async function AdminPartnersPage() {
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
                  <strong style={{ fontSize: 15 }}>{partner.name}</strong>
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
                              openActionCounts.get(partner.id) === 1
                                ? "action"
                                : "actions"
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
