import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import {
  getPartnerById,
  listPartnerNotes,
  listPartnerRelations,
  resolveAuthorNames,
  listRelationshipLeadOptions,
} from "@/lib/partners-queries";
import { updatePartner, addPartnerNote } from "@/lib/partners-actions";
import { PartnerRelationsPanel } from "@/components/partners/partner-relations-panel";
import { AskAboutThis } from "@/components/help-agent/ask-about-this";
import { matchInstructorsForPartner } from "@/lib/partner-instructor-matching";
import { PersonLink } from "@/components/people-strategy/person-link";
import { OperationalContextPanel } from "@/components/people-strategy/operational-context-panel";
import { EntityActionPanel } from "@/components/work/entity-action-panel";
import { OperationalTimeline } from "@/components/people-strategy/operational-timeline";
import { deriveOperationalTimeline } from "@/lib/people-strategy/operational-timeline";
import { getOperationalContextForEntity } from "@/lib/people-strategy/operational-context-queries";
import { canCreateAction } from "@/lib/people-strategy/action-permissions";
import {
  isActionTrackerEnabled,
  isStrategicInitiativesEnabled,
} from "@/lib/feature-flags";
import { deriveStrategicEntityContext } from "@/lib/people-strategy/strategic-entity-context";
import { StrategicEntityPanel } from "@/components/people-strategy/strategic-entity-panel";
import {
  PARTNER_PRIORITIES,
  PARTNER_TYPES,
  PARTNER_PRIORITY_LABELS,
  PARTNER_TYPE_LABELS,
  PARTNER_NOTE_KINDS,
  PARTNER_NOTE_KIND_LABELS,
  partnerStageLabel,
  partnerPriorityLabel,
  partnerNoteKindLabel,
  partnerStuckReasons,
} from "@/lib/partners-constants";
import { StageSelect } from "../stage-select";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner · Admin" };

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, marginTop: 2 }}>{value || "—"}</div>
    </div>
  );
}

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.user?.roles?.includes("ADMIN")) {
    redirect("/");
  }
  // Knowledge OS V2 promoted partners to a core front door (/partners), so
  // the profile is no longer dark behind ENABLE_PARTNER_PIPELINE — it is the
  // "Open full 360" target from the master database. Still ADMIN-only.

  const { id } = await params;
  const partner = await getPartnerById(id);
  if (!partner) notFound();

  const trackerEnabled = isActionTrackerEnabled();
  const viewer = {
    id: session?.user?.id ?? "",
    roles: session?.user?.roles ?? [],
    primaryRole: session?.user?.primaryRole ?? null,
    adminSubtypes: session?.user?.adminSubtypes ?? [],
  };

  const [notes, leads, matchResult, opsContext, relations] = await Promise.all([
    listPartnerNotes(id),
    listRelationshipLeadOptions(),
    matchInstructorsForPartner({
      requestedSubjects: partner.requestedSubjects,
      requestedAgeGroups: partner.requestedAgeGroups,
    }),
    trackerEnabled
      ? getOperationalContextForEntity("PARTNER", id, viewer)
      : Promise.resolve(null),
    listPartnerRelations(id),
  ]);
  const authorNames = await resolveAuthorNames([
    ...notes.map((n) => n.authorId),
    ...relations.requests.map((r) => r.ownerId),
  ]);
  const canCreate = canCreateAction(viewer);

  const stuck = partnerStuckReasons(
    { stage: partner.stage, nextFollowUpAt: partner.nextFollowUpAt, relationshipLeadId: partner.relationshipLeadId },
    new Date()
  );

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p className="badge">Admin · Partner</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>{partner.name}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <span className="badge">{partnerStageLabel(partner.stage)}</span>
            <span className="badge">{partnerPriorityLabel(partner.priority)} priority</span>
            {PARTNER_TYPE_LABELS[partner.partnerType as keyof typeof PARTNER_TYPE_LABELS] ? (
              <span className="badge">{PARTNER_TYPE_LABELS[partner.partnerType as keyof typeof PARTNER_TYPE_LABELS]}</span>
            ) : partner.type ? (
              <span className="badge">{partner.type}</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <AskAboutThis entityType="partner" entityId={partner.id} />
          <Link href="/admin/partners" className="button" style={{ fontSize: 13 }}>← All partners</Link>
          {trackerEnabled ? (
            <Link
              href={`/actions/new?relatedType=PARTNER&relatedId=${partner.id}`}
              className="button primary"
              style={{ fontSize: 13 }}
            >
              + Create action
            </Link>
          ) : null}
        </div>
      </div>

      {stuck.length > 0 ? (
        <div
          className="card"
          style={{ marginTop: 12, padding: "10px 14px", borderLeft: "4px solid #b91c1c", background: "#fef2f2" }}
        >
          <strong style={{ color: "#b91c1c", fontSize: 13 }}>Needs attention:</strong>{" "}
          <span style={{ fontSize: 13 }}>{stuck.join(" · ")}</span>
        </div>
      ) : null}

      {/* Stage mover */}
      <div className="card" style={{ marginTop: 14, padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Pipeline stage</span>
        <StageSelect partnerId={partner.id} stage={partner.stage} />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Changing the stage records a touchpoint on the timeline below.
        </span>
      </div>

      <div className="grid two" style={{ gap: 18, alignItems: "start", marginTop: 16 }}>
        {/* LEFT column */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Overview & contact */}
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Overview &amp; contact</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 10 }}>
              <Field label="Relationship lead" value={
                partner.relationshipLead ? (
                  <PersonLink id={partner.relationshipLead.id} style={{ color: "var(--ypp-purple)", fontWeight: 600 }}>
                    {partner.relationshipLead.name || partner.relationshipLead.email}
                  </PersonLink>
                ) : "Unassigned"
              } />
              <Field label="Location" value={partner.location} />
              <Field label="Source" value={partner.source} />
              <Field label="Contact" value={partner.contactName ? `${partner.contactName}${partner.contactTitle ? `, ${partner.contactTitle}` : ""}` : null} />
              <Field label="Email" value={partner.contactEmail} />
              <Field label="Phone" value={partner.contactPhone} />
              <Field label="Website" value={
                partner.website ? <Link href={partner.website} style={{ color: "var(--ypp-purple)" }}>{partner.website}</Link> : null
              } />
              <Field label="Last contacted" value={formatDate(partner.lastContactedAt)} />
              <Field label="Next follow-up" value={
                <span style={{ color: stuck.includes("Follow-up is overdue") ? "#b91c1c" : "inherit", fontWeight: 600 }}>
                  {formatDate(partner.nextFollowUpAt)}
                </span>
              } />
              <Field label="Meeting date" value={formatDate(partner.meetingDate)} />
            </div>
          </section>

          {/* Program needs */}
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Program needs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 10 }}>
              <Field label="Subjects requested" value={partner.requestedSubjects} />
              <Field label="Age groups" value={partner.requestedAgeGroups} />
              <Field label="Dates" value={partner.requestedDates} />
              <Field label="Format" value={partner.programFormat} />
              <Field label="Expected students" value={partner.expectedStudents?.toString()} />
              <Field label="Instructors needed" value={partner.instructorCountNeeded?.toString()} />
            </div>
            {partner.constraints ? (
              <p style={{ margin: "12px 0 0", fontSize: 13 }}>
                <strong>Constraints:</strong> {partner.constraints}
              </p>
            ) : null}
          </section>

          {/* Relationship operations: contacts, requests, agreements (KOS V2) */}
          <PartnerRelationsPanel
            partnerId={partner.id}
            relations={relations}
            leads={leads}
            ownerNames={authorNames}
          />

          {/* Notes & timeline */}
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Notes &amp; timeline</h2>
            <form action={addPartnerNote} className="form-grid" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={partner.id} />
              <div className="form-row">
                <label>Touchpoint type</label>
                <select name="kind" className="input" defaultValue="NOTE">
                  {PARTNER_NOTE_KINDS.map((k) => (
                    <option key={k} value={k}>{PARTNER_NOTE_KIND_LABELS[k]}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>What happened?</label>
                <textarea name="body" className="input" rows={2} required placeholder="Add a note, call recap, or decision…" />
              </div>
              <div className="form-row">
                <label>Schedule next follow-up (optional)</label>
                <input type="date" name="nextFollowUpAt" className="input" />
              </div>
              <button type="submit" className="button">Add to timeline</button>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {notes.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  No touchpoints yet. Log your first call, email, or meeting so the history stays in one place.
                </p>
              ) : (
                notes.map((n) => (
                  <div key={n.id} style={{ borderLeft: "3px solid var(--ypp-purple, #6b21c8)", paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      <strong style={{ color: "inherit" }}>{partnerNoteKindLabel(n.kind)}</strong>
                      {" · "}{formatDate(n.createdAt)}
                      {n.authorId && authorNames.get(n.authorId) ? ` · ${authorNames.get(n.authorId)}` : ""}
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, whiteSpace: "pre-wrap" }}>{n.body}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Instructor matches */}
          <section className="card">
            <h2 className="section-title" style={{ marginTop: 0 }}>Instructor matches</h2>
            {matchResult.needTokens.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Add the subjects and age groups this partner needs (in “Program needs” / Edit details)
                to see instructors whose tags fit.
              </p>
            ) : matchResult.matches.length === 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
                No instructors match these needs yet. Try broadening the subject or age-group wording,
                or tag more instructors with these skills.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 10 }}>
                {matchResult.matches.map((m) => (
                  <li key={m.profileId} style={{ borderLeft: "3px solid #166534", paddingLeft: 10 }}>
                    <PersonLink id={m.userId} style={{ fontSize: 13, fontWeight: 600, color: "var(--ypp-purple)" }}>
                      {m.name}
                    </PersonLink>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {m.reasons.join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Action operating panel (Action System 4.0): suggested next move,
              overdue/blocked/unowned counts, and the Work Hub lens. */}
          {trackerEnabled && opsContext ? (
            <section
              className="card"
              style={{ marginTop: 14 }}
              aria-label="Action operating panel"
            >
              <h2 className="section-title" style={{ marginTop: 0 }}>
                Action operating panel
              </h2>
              <EntityActionPanel
                actions={opsContext.actions}
                viewer={viewer}
                entityType="PARTNER"
                entityId={partner.id}
                entityLabel={partner.name}
              />
            </section>
          ) : null}

          {/* Partner operations: related meetings + actions */}
          {trackerEnabled && opsContext ? (
            <OperationalContextPanel
              title="Partnership Operations"
              subtitle={partner.name}
              health={opsContext.health}
              meetings={opsContext.meetings}
              actions={opsContext.actions}
              openFollowUps={opsContext.openFollowUps}
              recentDecisions={opsContext.recentDecisions}
              canCreate={canCreate}
              createActionHref={`/actions/new?relatedType=PARTNER&relatedId=${partner.id}`}
              createMeetingHref={`/actions/meetings?new=1&relatedType=PARTNER&relatedId=${partner.id}`}
              emptyActionsHint="No actions are linked to this partner yet. Add a follow-up so it doesn't go cold."
              emptyMeetingsHint="No outreach meeting has been tracked for this partner yet."
            />
          ) : null}

          {trackerEnabled && opsContext && isStrategicInitiativesEnabled() ? (
            <div style={{ marginTop: 14 }}>
              <StrategicEntityPanel
                context={deriveStrategicEntityContext({
                  actions: opsContext.actions,
                  meetings: opsContext.meetings,
                })}
              />
            </div>
          ) : null}

          {trackerEnabled && opsContext ? (
            <OperationalTimeline
              events={deriveOperationalTimeline({
                meetings: opsContext.meetings,
                actions: opsContext.actions,
                decisions: opsContext.recentDecisions,
                followUps: opsContext.openFollowUps,
              })}
              compact
              createActionHref={`/actions/new?relatedType=PARTNER&relatedId=${partner.id}`}
              createMeetingHref={`/actions/meetings?new=1&relatedType=PARTNER&relatedId=${partner.id}`}
            />
          ) : null}

          {/* Linked classes */}
          {partner.classOfferings.length > 0 ? (
            <section className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>Linked classes</h2>
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
                {partner.classOfferings.map((c) => (
                  <li key={c.id} style={{ fontSize: 13 }}>
                    <Link href={`/admin/classes/${c.id}`} style={{ color: "var(--ypp-purple)" }}>{c.title}</Link>
                    <span style={{ color: "var(--muted)" }}> · {c.status.replace(/_/g, " ").toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Outcome */}
          {partner.outcome ? (
            <section className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>Outcome</h2>
              <p style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{partner.outcome}</p>
            </section>
          ) : null}
        </div>
      </div>

      {/* Edit details */}
      <details className="card" style={{ marginTop: 18, padding: "14px 16px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Edit details</summary>
        <form action={updatePartner} className="form-grid" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={partner.id} />
          <div className="form-row">
            <label>Name *</label>
            <input type="text" name="name" className="input" defaultValue={partner.name} required maxLength={160} />
          </div>
          <div className="form-row">
            <label>Type</label>
            <select name="partnerType" className="input" defaultValue={partner.partnerType ?? ""}>
              <option value="">— Select type —</option>
              {PARTNER_TYPES.map((t) => (
                <option key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Priority</label>
            <select name="priority" className="input" defaultValue={partner.priority ?? "MEDIUM"}>
              {PARTNER_PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>{PARTNER_PRIORITY_LABELS[pr]}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Relationship lead</label>
            <select name="relationshipLeadId" className="input" defaultValue={partner.relationshipLead?.id ?? ""}>
              <option value="">— No Relationship Lead —</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.name || lead.email}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Source</label>
            <input type="text" name="source" className="input" defaultValue={partner.source ?? ""} placeholder="Referral, inbound, outreach list…" />
          </div>
          <div className="form-row">
            <label>Location</label>
            <input type="text" name="location" className="input" defaultValue={partner.location ?? ""} />
          </div>
          <div className="form-row">
            <label>Website</label>
            <input type="url" name="website" className="input" defaultValue={partner.website ?? ""} placeholder="https://…" />
          </div>
          <div className="form-row">
            <label>Contact name</label>
            <input type="text" name="contactName" className="input" defaultValue={partner.contactName ?? ""} />
          </div>
          <div className="form-row">
            <label>Contact title</label>
            <input type="text" name="contactTitle" className="input" defaultValue={partner.contactTitle ?? ""} />
          </div>
          <div className="form-row">
            <label>Contact email</label>
            <input type="email" name="contactEmail" className="input" defaultValue={partner.contactEmail ?? ""} />
          </div>
          <div className="form-row">
            <label>Contact phone</label>
            <input type="tel" name="contactPhone" className="input" defaultValue={partner.contactPhone ?? ""} />
          </div>
          <div className="form-row">
            <label>Last contacted</label>
            <input type="date" name="lastContactedAt" className="input" defaultValue={toDateInput(partner.lastContactedAt)} />
          </div>
          <div className="form-row">
            <label>Next follow-up</label>
            <input type="date" name="nextFollowUpAt" className="input" defaultValue={toDateInput(partner.nextFollowUpAt)} />
          </div>
          <div className="form-row">
            <label>Meeting date</label>
            <input type="date" name="meetingDate" className="input" defaultValue={toDateInput(partner.meetingDate)} />
          </div>
          <div className="form-row">
            <label>Subjects requested</label>
            <input type="text" name="requestedSubjects" className="input" defaultValue={partner.requestedSubjects ?? ""} placeholder="Coding, Public Speaking, Business…" />
          </div>
          <div className="form-row">
            <label>Age groups</label>
            <input type="text" name="requestedAgeGroups" className="input" defaultValue={partner.requestedAgeGroups ?? ""} placeholder="Middle school, High school…" />
          </div>
          <div className="form-row">
            <label>Requested dates</label>
            <input type="text" name="requestedDates" className="input" defaultValue={partner.requestedDates ?? ""} placeholder="Week of July 15…" />
          </div>
          <div className="form-row">
            <label>Program format</label>
            <input type="text" name="programFormat" className="input" defaultValue={partner.programFormat ?? ""} placeholder="In-person, virtual, hybrid…" />
          </div>
          <div className="form-row">
            <label>Expected students</label>
            <input type="number" name="expectedStudents" className="input" defaultValue={partner.expectedStudents?.toString() ?? ""} min={0} />
          </div>
          <div className="form-row">
            <label>Instructors needed</label>
            <input type="number" name="instructorCountNeeded" className="input" defaultValue={partner.instructorCountNeeded?.toString() ?? ""} min={0} />
          </div>
          <div className="form-row">
            <label>Constraints</label>
            <textarea name="constraints" className="input" rows={2} defaultValue={partner.constraints ?? ""} />
          </div>
          <div className="form-row">
            <label>Notes</label>
            <textarea name="notes" className="input" rows={2} defaultValue={partner.notes ?? ""} />
          </div>
          <div className="form-row">
            <label>Outcome</label>
            <textarea name="outcome" className="input" rows={2} defaultValue={partner.outcome ?? ""} placeholder="How did the partnership go? Capture it for next time." />
          </div>
          <button type="submit" className="button">Save Changes</button>
        </form>
      </details>
    </div>
  );
}
