import Link from "next/link";
import { notFound } from "next/navigation";

import ActionItemForm, {
  type ActionItemFormInitial,
} from "@/components/people-strategy/action-item-form";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled, isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { requirePageRoles } from "@/lib/page-guards";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import {
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";
import {
  getActionTemplate,
  listActionTemplates,
  templateToFormInitial,
} from "@/lib/people-strategy/action-templates";
import { ACTION_PRIORITY_LABELS, ACTION_PRIORITY_VALUES } from "@/lib/people-strategy/constants";
import { isActionType } from "@/lib/people-strategy/action-types";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import { getMeetingById } from "@/lib/people-strategy/meetings-queries";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { actionPrefillFromQuery } from "@/lib/people-strategy/action-prefill";
import {
  ACTION_SOURCE_HEADER,
  deriveActionSourceLabel,
  deriveActionStrategicLinkage,
  isActionSourceType,
  parseStrategicLink,
} from "@/lib/people-strategy/action-source";

export const dynamic = "force-dynamic";
export const metadata = { title: "New action · Action Tracker" };

/**
 * Related-entity types that can prefill a linked action from a "Create action
 * for this …" CTA. INSTRUCTOR_APPLICATION is a valid link value but its panel
 * is deferred (plan §4), so it is not offered as a prefill here.
 */
const PREFILLABLE_RELATED_TYPES = new Set([
  "CLASS_OFFERING",
  "MENTORSHIP",
  "USER",
  "PARTNER",
]);

export default async function NewActionInTrackerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Feature flag: with ENABLE_ACTION_TRACKER off, the route is unreachable.
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requirePageRoles([...OFFICER_TIER_ROLES]);

  const sp = (await searchParams) ?? {};
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const templateId = first(sp.template);

  // The honest 4.0 context (source provenance + strategic link + suggestions),
  // parsed + lightly validated by the one tested reader.
  const ctx = actionPrefillFromQuery(sp);

  // Optional related-entity prefill. Both params must be present and the type
  // must be prefillable; the entity is resolved + existence-checked server-side
  // so an invalid or stale link simply falls back to an unlinked form.
  const relatedTypeParam = first(sp.relatedType);
  const relatedIdParam = first(sp.relatedId);
  const relatedPromise =
    relatedTypeParam && relatedIdParam && PREFILLABLE_RELATED_TYPES.has(relatedTypeParam)
      ? loadRelatedEntitySummary(relatedTypeParam, relatedIdParam)
      : Promise.resolve(null);

  // Optional source-meeting prefill (a decision / recap CTA). Existence-checked
  // so a hand-edited / stale id falls back to an unlinked form instead of a
  // submit-time FK error.
  const meetingIdParam = first(sp.fromMeeting)?.trim() || null;
  const meetingPromise = meetingIdParam
    ? getMeetingById(meetingIdParam).catch(() => null)
    : Promise.resolve(null);

  const [users, departments, templates, template, relatedSummary, sourceMeeting] =
    await Promise.all([
      listActionAssignableUsers(),
      listActionDepartments(),
      listActionTemplates(),
      templateId ? getActionTemplate(templateId) : Promise.resolve(null),
      relatedPromise,
      meetingPromise,
    ]);

  // Validated scalar prefill (title / description / area / priority / type / due
  // date). Anything malformed is dropped, so a bad URL never throws or leaks a
  // bogus value into the form.
  const titleParam = ctx.title ? ctx.title.slice(0, 300) : "";
  const descParam = ctx.description ? ctx.description.slice(0, 10_000) : "";
  const areaRaw = first(sp.area);
  const areaParam =
    areaRaw && isMeetingCategory(areaRaw.trim().toUpperCase())
      ? areaRaw.trim().toUpperCase()
      : null;
  const priorityParam =
    ctx.priority && (ACTION_PRIORITY_VALUES as readonly string[]).includes(ctx.priority)
      ? ctx.priority
      : null;
  const typeRaw = first(sp.type);
  const typeParam = typeRaw && isActionType(typeRaw) ? typeRaw : null;
  const exactDueDate =
    ctx.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(ctx.dueDate) ? ctx.dueDate : null;
  const deadlineStart =
    exactDueDate ??
    (ctx.dueInDays != null
      ? toDateInputValue(addDays(new Date(), ctx.dueInDays))
      : null);

  // Validate + resolve the EXPLICIT strategic link against the curated registry,
  // so a bad id degrades to "no link" instead of a misleading chip.
  const strategicParsed = parseStrategicLink({
    strategicInitiativeId: ctx.strategicInitiativeId,
    strategicProjectId: ctx.strategicProjectId,
  });
  const strategicLink = strategicParsed.ok
    ? strategicParsed.link
    : { initiativeId: null, projectId: null };
  const linkage = deriveActionStrategicLinkage({
    strategicInitiativeId: strategicLink.initiativeId,
    strategicProjectId: strategicLink.projectId,
  });
  const strategicLinkLabel =
    [linkage.initiativeTitle, linkage.projectTitle].filter(Boolean).join(" › ") || null;

  // Resolve the source descriptor for the context-aware header + chip.
  const sourceTypeParam = isActionSourceType(ctx.sourceType) ? ctx.sourceType : null;
  const sourceLabel =
    sourceTypeParam || sourceMeeting || ctx.sourceActionId || relatedSummary
      ? deriveActionSourceLabel({
          sourceType: sourceTypeParam,
          officerMeetingId: sourceMeeting?.id ?? null,
          sourceActionId: ctx.sourceActionId ?? null,
          relatedEntityType: relatedSummary?.type ?? null,
          relatedEntityId: relatedSummary?.id ?? null,
        })
      : null;
  const sourceHeader = sourceTypeParam ? ACTION_SOURCE_HEADER[sourceTypeParam] : null;

  // A suggested owner is honored only when it is a real assignable user.
  const suggestedOwnerId =
    ctx.suggestedOwnerId && users.some((u) => u.id === ctx.suggestedOwnerId)
      ? ctx.suggestedOwnerId
      : null;

  const prefillInitial: ActionItemFormInitial = {
    ...(titleParam ? { title: titleParam } : {}),
    ...(descParam ? { description: descParam } : {}),
    ...(areaParam ? { goalCategory: areaParam } : {}),
    ...(priorityParam ? { priority: priorityParam } : {}),
    ...(typeParam ? { actionType: typeParam } : {}),
    ...(deadlineStart ? { deadlineStart } : {}),
    ...(sourceMeeting ? { officerMeetingId: sourceMeeting.id } : {}),
    // --- Action System 4.0 honest context ---
    ...(sourceTypeParam ? { sourceType: sourceTypeParam } : {}),
    ...(ctx.sourceId ? { sourceId: ctx.sourceId } : {}),
    ...(ctx.sourceActionId ? { sourceActionId: ctx.sourceActionId } : {}),
    ...(strategicLink.initiativeId
      ? { strategicInitiativeId: strategicLink.initiativeId }
      : {}),
    ...(strategicLink.projectId ? { strategicProjectId: strategicLink.projectId } : {}),
    ...(ctx.successDefinition
      ? { successDefinition: ctx.successDefinition.slice(0, 10_000) }
      : {}),
    ...(suggestedOwnerId ? { suggestedOwnerId } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(sourceHeader ? { sourceHeader } : {}),
    ...(strategicLinkLabel ? { strategicLinkLabel } : {}),
  };
  const hasPrefill = Object.keys(prefillInitial).length > 0;

  const templateInitial = template ? templateToFormInitial(template) : undefined;
  const initial: ActionItemFormInitial | undefined =
    relatedSummary || templateInitial || hasPrefill
      ? {
          ...(templateInitial ?? {}),
          ...(relatedSummary
            ? {
                relatedEntityType: relatedSummary.type,
                relatedEntityId: relatedSummary.id,
                relatedEntityLabel: relatedSummary.label,
                relatedEntityTypeLabel: relatedSummary.typeLabel,
              }
            : {}),
          // Explicit scalar prefill wins over a template's defaults.
          ...prefillInitial,
        }
      : undefined;

  const showPeople = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);

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
            {sourceHeader ?? "New action item"}
          </h1>
          <p className="page-subtitle">
            {strategicLinkLabel
              ? `This action ladders up to ${strategicLinkLabel} — it'll show on that strategy view.`
              : relatedSummary
                ? `This action will be linked to ${relatedSummary.typeLabel.toLowerCase()} “${relatedSummary.label}.”`
                : sourceLabel
                  ? `${sourceLabel} — fill in who owns it and what done means.`
                  : template
                    ? `Pre-filled from the “${template.name}” template — adjust anything before saving.`
                    : "Start from a template below, or fill in the form directly."}
          </p>
        </div>
      </div>

      {/* Template gallery — shown until a template is chosen. Hidden when the
          action is being linked to a specific entity, so navigating to a
          template never drops the related-entity params. */}
      {!template && !relatedSummary && templates.length > 0 ? (
        <section style={{ marginTop: 16 }}>
          <h2 className="ps-section-title" style={{ margin: "0 0 10px" }}>
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

      <div className="ps-form-card" style={{ marginTop: 18, maxWidth: 760 }}>
        {template ? (
          <p style={{ margin: "0 0 12px" }}>
            <Link href="/actions/new" className="button outline small">
              ← Choose a different template
            </Link>
          </p>
        ) : null}
        <ActionItemForm
          users={users}
          departments={departments}
          initial={initial}
          currentUserId={viewer.id}
        />
      </div>
    </div>
  );
}
