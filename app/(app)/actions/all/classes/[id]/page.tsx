import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
} from "@/lib/feature-flags";
import {
  executingInstructors,
  formatClassDateRange,
  formatClassSchedule,
  getTrackerClass,
} from "@/lib/people-strategy/class-tracker";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { PersonLink } from "@/components/people-strategy/person-link";
import { Pill } from "@/components/people-strategy/pills";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · Class" };

const ROLE_LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  margin: "0 0 4px",
};

function Role({
  label,
  id,
  name,
  sub,
}: {
  label: string;
  id?: string | null;
  name: string | null;
  sub?: string | null;
}) {
  return (
    <div>
      <p style={ROLE_LABEL}>{label}</p>
      {name ? (
        <PersonLink id={id} style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-ink)" }}>
          {name}
        </PersonLink>
      ) : (
        <span style={{ fontSize: 14, color: "var(--muted)" }}>Unassigned</span>
      )}
      {sub ? <div style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</div> : null}
    </div>
  );
}

export default async function TrackerClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const { id } = await params;
  const offering = await getTrackerClass(id);
  if (!offering) notFound();

  const canManageClasses = viewer.roles.includes("ADMIN");
  const executing = executingInstructors(offering);
  const schedule = formatClassSchedule(offering);
  const classesBackHref = canManageClasses ? "/people/classes" : "/actions/all/classes";

  return (
    <div className="page-shell" style={{ maxWidth: 880 }}>
      <Link
        href={classesBackHref}
        style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Classes
      </Link>
      <ActionTrackerTabsV2 active="classes" />

      <div className="topbar" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {offering.title}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {offering.chapter?.name ?? "Unassigned chapter"}
            {schedule ? ` · ${schedule}` : ""} · {formatClassDateRange(offering)}
          </p>
        </div>
        {canManageClasses ? (
          <Link href={`/admin/classes/${offering.id}`} className="button small">
            Manage in Classes
          </Link>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
        <Pill tone="neutral">{offering.status}</Pill>
        <Pill tone="neutral">{offering.deliveryMode}</Pill>
      </div>

      {/* The four ownership roles for a class (#2). */}
      <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", margin: "0 0 12px" }}>
          Ownership
        </h2>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Role
            label="Partner"
            id={null}
            name={offering.partner?.name ?? null}
          />
          <Role
            label="Relationship Lead"
            id={offering.partner?.relationshipLead?.id}
            name={
              offering.partner?.relationshipLead?.name ??
              offering.partner?.relationshipLead?.email ??
              null
            }
          />
          <Role
            label="Lead Instructor"
            id={offering.instructor?.id}
            name={offering.instructor?.name ?? offering.instructor?.email ?? null}
          />
          <div>
            <p style={ROLE_LABEL}>Instructors</p>
            {executing.length === 0 ? (
              <span style={{ fontSize: 14, color: "var(--muted)" }}>None</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {executing.map((e) => (
                  <PersonLink
                    key={e.id}
                    id={e.id}
                    style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-ink)" }}
                  >
                    {e.name}
                  </PersonLink>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {!canManageClasses ? (
        <p style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
          Read-only — class details are managed in the Classes area.
        </p>
      ) : null}
    </div>
  );
}
