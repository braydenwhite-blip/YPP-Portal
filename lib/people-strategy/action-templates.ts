import type { ActionTemplate } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { addDays } from "@/lib/leadership-action-center/dates";
import { actionTypeFromHint } from "@/lib/people-strategy/action-types";

import type { ActionItemFormInitial } from "@/components/people-strategy/action-item-form";

/**
 * People Strategy — Action Templates (Phase 9).
 *
 * Read queries + a pure mapper from a template to the new-action form's initial
 * values. Templates remove the blank-page tax for recurring YPP leadership
 * tasks. Plain (non-"use server") functions, mirroring `action-queries.ts`;
 * gated by ENABLE_ACTION_TRACKER.
 */

export type ActionTemplateOption = Pick<
  ActionTemplate,
  | "id"
  | "name"
  | "description"
  | "category"
  | "defaultPriority"
  | "deadlineOffsetDays"
>;

const TEMPLATE_OPTION_SELECT = {
  id: true,
  name: true,
  description: true,
  category: true,
  defaultPriority: true,
  deadlineOffsetDays: true,
} as const;

/** Active templates for the gallery, grouped-friendly (category then name). */
export async function listActionTemplates(): Promise<ActionTemplateOption[]> {
  if (!isActionTrackerEnabled()) return [];
  return prisma.actionTemplate.findMany({
    where: { archivedAt: null },
    select: TEMPLATE_OPTION_SELECT,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function getActionTemplate(id: string): Promise<ActionTemplate | null> {
  if (!isActionTrackerEnabled()) return null;
  return prisma.actionTemplate.findFirst({ where: { id, archivedAt: null } });
}

/**
 * Build the description for a templated item: the base description followed by a
 * markdown-style checklist, so the definition of done travels with the item.
 */
export function templateDescription(template: ActionTemplate): string {
  const parts: string[] = [];
  if (template.descriptionTemplate) parts.push(template.descriptionTemplate.trim());
  if (template.checklist.length > 0) {
    parts.push("Checklist:");
    parts.push(...template.checklist.map((step) => `- [ ] ${step}`));
  }
  return parts.join("\n");
}

/**
 * Map a template to the new-action form's initial values. Pure (takes `now`)
 * so it is deterministic and testable. The deadline is seeded `deadlineOffsetDays`
 * out from `now` when the template specifies one.
 */
export function templateToFormInitial(
  template: ActionTemplate,
  now: Date = new Date()
): ActionItemFormInitial {
  const deadlineStart =
    template.deadlineOffsetDays != null
      ? addDays(now, template.deadlineOffsetDays)
      : null;

  return {
    title: template.titleTemplate,
    description: templateDescription(template),
    goalCategory: template.goalCategory,
    // Best-effort: seed the Action Type from the template's category so a
    // "Camp follow-up" template lands as a PARTNERSHIP/FOLLOW_UP action. Falls
    // back to untyped when the category doesn't map to a known type.
    actionType: actionTypeFromHint(template.category),
    status: "NOT_STARTED",
    priority: template.defaultPriority,
    visibility: template.defaultVisibility,
    deadlineStart,
  };
}
