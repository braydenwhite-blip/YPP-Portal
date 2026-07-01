import { notFound } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { ActionCreateForm } from "@/components/command-center/action-create-form";
import { CommandModeToggle } from "@/components/command-center/command-mode";
import { SimpleSurface, SimpleActionStrip, type SimpleAction } from "@/components/command-center/simple";
import type { ActionItemFormInitial } from "@/components/people-strategy/action-item-form";
import { PageHeaderV2 } from "@/components/ui-v2";
import { OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { addDays, toDateInputValue } from "@/lib/leadership-action-center/dates";
import { requirePageRoles } from "@/lib/page-guards";
import { actionPrefillFromQuery } from "@/lib/people-strategy/action-prefill";
import {
  listActionAssignableUsers,
  listActionDepartments,
} from "@/lib/people-strategy/action-queries";
import {
  ACTION_SOURCE_HEADER,
  deriveActionSourceLabel,
  deriveActionStrategicLinkage,
  isActionSourceType,
  parseStrategicLink,
} from "@/lib/people-strategy/action-source";
import {
  getActionTemplate,
  templateToFormInitial,
} from "@/lib/people-strategy/action-templates";
import { ACTION_PRIORITY_VALUES } from "@/lib/people-strategy/constants";
import { isActionType } from "@/lib/people-strategy/action-types";
import { loadRelatedEntitySummary } from "@/lib/people-strategy/connections";
import { isMeetingCategory } from "@/lib/people-strategy/meeting-categories";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "New action · Work" };

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
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requirePageRoles([...OFFICER_TIER_ROLES]);

  const sp = (await searchParams) ?? {};
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const templateId = first(sp.template);
  const relatedTypeParam = first(sp.relatedType);
  const relatedIdParam = first(sp.relatedId);
  const ctx = actionPrefillFromQuery(sp);

  const relatedPromise =
    relatedTypeParam && relatedIdParam && PREFILLABLE_RELATED_TYPES.has(relatedTypeParam)
      ? loadRelatedEntitySummary(relatedTypeParam, relatedIdParam)
      : Promise.resolve(null);

  const [users, departments, template, relatedSummary] =
    await Promise.all([
      listActionAssignableUsers(),
      listActionDepartments(),
      templateId ? getActionTemplate(templateId) : Promise.resolve(null),
      relatedPromise,
    ]);

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

  const sourceTypeParam = isActionSourceType(ctx.sourceType) ? ctx.sourceType : null;
  const sourceLabel =
    sourceTypeParam || ctx.sourceActionId || relatedSummary
      ? deriveActionSourceLabel({
          sourceType: sourceTypeParam,
          sourceActionId: ctx.sourceActionId ?? null,
          relatedEntityType: relatedSummary?.type ?? null,
          relatedEntityId: relatedSummary?.id ?? null,
        })
      : null;
  const sourceHeader = sourceTypeParam ? ACTION_SOURCE_HEADER[sourceTypeParam] : null;

  const suggestedOwnerId =
    ctx.suggestedOwnerId && users.some((u) => u.id === ctx.suggestedOwnerId)
      ? ctx.suggestedOwnerId
      : null;

  // Resolve the chapter scope carried from a chapter / meeting / person / partner
  // surface so the form shows a chapter chip and the action is born chapter-scoped.
  const chapter = ctx.chapterId
    ? await prisma.chapter.findUnique({
        where: { id: ctx.chapterId },
        select: { id: true, name: true },
      })
    : null;

  const prefillInitial: ActionItemFormInitial = {
    ...(titleParam ? { title: titleParam } : {}),
    ...(descParam ? { description: descParam } : {}),
    ...(areaParam ? { goalCategory: areaParam } : {}),
    ...(priorityParam ? { priority: priorityParam } : {}),
    ...(typeParam ? { actionType: typeParam } : {}),
    ...(deadlineStart ? { deadlineStart } : {}),
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
    ...(chapter ? { chapterId: chapter.id, chapterLabel: chapter.name } : {}),
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
          ...prefillInitial,
        }
      : undefined;

  const pageTitle = sourceHeader ?? (template ? `From “${template.name}”` : "New action");
  const pageSubtitle = strategicLinkLabel
    ? `Linked to ${strategicLinkLabel}.`
    : relatedSummary
      ? `Linked to ${relatedSummary.typeLabel.toLowerCase()} “${relatedSummary.label}.”`
      : sourceLabel
        ? `${sourceLabel} — who owns it and when is it due?`
        : template
          ? "Adjust if needed, then save."
          : "Title, people, and due date — under a minute.";

  const initiativeLink =
    strategicLink.initiativeId
      ? {
          id: strategicLink.initiativeId,
          goalCategory: areaParam ?? undefined,
        }
      : undefined;

  const strip: SimpleAction[] = [
    { label: "All actions", href: "/actions", icon: "layers" },
    { label: "Clear my queue", href: "/work/queue?queue=my", icon: "list" },
  ];

  return (
    <div className={skin.portalSkin}>
    <SimpleSurface
      maxWidth={720}
      header={
        <PageHeaderV2
          eyebrow="Work"
          backHref="/actions"
          backLabel="Actions"
          title={pageTitle}
          subtitle={pageSubtitle}
          actions={<CommandModeToggle />}
        />
      }
      calm={undefined}
      aboveBrowse={
        <div className="flex flex-col gap-5">
          <ActionCreateForm
            users={users}
            departments={departments}
            currentUserId={viewer.id}
            redirectTo="/actions"
            cancelHref="/actions"
            initiativeLink={initiativeLink}
            initial={initial}
            templateChangeHref={template ? "/actions/new" : undefined}
          />
          <SimpleActionStrip actions={strip} />
        </div>
      }
    />
    </div>
  );
}
