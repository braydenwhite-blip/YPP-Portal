import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm, {
  type ActionItemFormInitial,
} from "@/components/people-strategy/action-item-form";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { isCpoOrBoard } from "@/lib/people-strategy/action-permissions";
import {
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";
import {
  getActionTemplate,
  listActionTemplates,
  templateToFormInitial,
} from "@/lib/people-strategy/action-templates";
import { ACTION_PRIORITY_LABELS } from "@/lib/people-strategy/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "New action · Action Tracker" };

export default async function NewActionInTrackerPage({
  searchParams,
}: {
  searchParams?: Promise<{ template?: string }>;
}) {
  // Feature flag: with ENABLE_ACTION_TRACKER off, the route is unreachable.
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requirePageRoles([...OFFICER_TIER_ROLES]);

  const templateId = (await searchParams)?.template;

  const [users, departments, templates, template] = await Promise.all([
    listActionAssignableUsers(),
    listActionDepartments(),
    listActionTemplates(),
    templateId ? getActionTemplate(templateId) : Promise.resolve(null),
  ]);

  const initial: ActionItemFormInitial | undefined = template
    ? templateToFormInitial(template)
    : undefined;

  const showPeople = isPeopleDashboardEnabled() && isCpoOrBoard(viewer);

  return (
    <div className="page-shell">
      <Link
        href="/actions/all"
        style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textDecoration: "none" }}
      >
        ← Action Tracker
      </Link>
      <ActionTrackerTabs showPeople={showPeople} />

      <div className="topbar" style={{ marginTop: 16 }}>
        <div>
          <p className="badge">Action Tracker</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            New action item
          </h1>
          <p className="page-subtitle">
            {template
              ? `Pre-filled from the “${template.name}” template — adjust anything before saving.`
              : "Start from a template below, or fill in the form directly."}
          </p>
        </div>
      </div>

      {/* Template gallery — shown until a template is chosen. */}
      {!template && templates.length > 0 ? (
        <section style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: "var(--ypp-ink)" }}>
            Start from a template
          </h2>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/actions/new?template=${t.id}`}
                className="card"
                style={{ padding: "12px 14px", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong style={{ fontSize: 14 }}>{t.name}</strong>
                  {t.category ? (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.category}</span>
                  ) : null}
                </div>
                {t.description ? (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{t.description}</p>
                ) : null}
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--muted)" }}>
                  {ACTION_PRIORITY_LABELS[t.defaultPriority]} priority
                  {t.deadlineOffsetDays != null ? ` · due in ${t.deadlineOffsetDays}d` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="card" style={{ marginTop: 16, maxWidth: 720 }}>
        {template ? (
          <p style={{ margin: "0 0 12px" }}>
            <Link href="/actions/new" className="button outline small">
              ← Choose a different template
            </Link>
          </p>
        ) : null}
        <ActionItemForm users={users} departments={departments} initial={initial} />
      </div>
    </div>
  );
}
