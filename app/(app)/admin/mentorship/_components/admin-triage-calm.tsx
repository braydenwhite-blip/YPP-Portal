import {
  EmptySimpleState,
  PrimaryFocusCard,
  SimpleListCard,
  SimpleRow,
} from "@/components/command-center/simple";
import type { CcIconName } from "@/components/command-center/icons";
import type { StatusTone } from "@/components/ui-v2";
import type {
  AdminActionItem,
  InstructorMentorshipOpsSummary,
} from "@/lib/instructor-mentorship-ops";

/**
 * Calm Mentorship, Phase 11 — the admin oversight surface in two densities.
 *
 * Executive keeps the full eight-tab cockpit (pulse, approvals, pairings,
 * analytics). Calm leads instead with a single triage: the one program-level
 * move that matters most right now plus a short list of what else needs
 * attention, with the full cockpit one click away. No oversight action is
 * removed — it is moved out of the calm default and behind a disclosure.
 */

// The cockpit now lives on the hub's admin POV, so tab links append `&tab=`.
const ADMIN_BASE = "/mentorship?view=admin";

export type TriageFocus = {
  eyebrow: string;
  title: string;
  reason: string;
  ctaLabel: string;
  ctaHref: string;
  icon: CcIconName;
  tone: "brand" | "success";
};

export type TriageItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  badge: string;
  tone: StatusTone;
  icon: CcIconName;
};

/** Plain-language presentation for each action-queue kind. */
const KIND_META: Record<
  AdminActionItem["kind"],
  { badge: string; tone: StatusTone; icon: CcIconName }
> = {
  UNASSIGNED_INSTRUCTOR: { badge: "Unstaffed", tone: "danger", icon: "user" },
  NO_GOALS: { badge: "No G&R", tone: "warning", icon: "flag" },
  OVERDUE_CHECK_IN: { badge: "Quiet", tone: "warning", icon: "clock" },
  PENDING_REVIEW: { badge: "Approval", tone: "info", icon: "scale" },
  STALLED_GOAL: { badge: "Stalled", tone: "warning", icon: "hourglass" },
};

/**
 * The single most urgent program-level move, derived from the always-loaded ops
 * summary. Ordered by what blocks the program most: nobody to mentor a person at
 * all, then approvals piling up, then relationships going quiet, then stalled or
 * unset goals. When every count is zero the program is healthy.
 */
export function deriveTriageFocus(
  summary: InstructorMentorshipOpsSummary
): TriageFocus {
  if (summary.unassignedInstructors > 0) {
    const n = summary.unassignedInstructors;
    return {
      eyebrow: "Staff the program",
      title: `${n} mentee${n === 1 ? "" : "s"} need a mentor`,
      reason:
        "Pairing them is the highest-leverage move — nothing else in their cycle can start until they have a mentor.",
      ctaLabel: "Open assignments",
      ctaHref: `${ADMIN_BASE}&tab=assignments`,
      icon: "users",
      tone: "brand",
    };
  }
  if (summary.pendingReviews > 0) {
    const n = summary.pendingReviews;
    return {
      eyebrow: "Clear the approvals",
      title: `${n} review${n === 1 ? "" : "s"} waiting on a chair`,
      reason:
        "Mentees can't see their feedback until these reviews are approved. Clear the queue to keep the cycle moving.",
      ctaLabel: "Open approvals",
      ctaHref: `${ADMIN_BASE}&tab=approvals`,
      icon: "scale",
      tone: "brand",
    };
  }
  if (summary.overdueCheckIns > 0) {
    const n = summary.overdueCheckIns;
    return {
      eyebrow: "Re-engage",
      title: `${n} relationship${n === 1 ? "" : "s"} have gone quiet`,
      reason:
        "No recent or upcoming session. A quick nudge keeps mentors and mentees from drifting apart.",
      ctaLabel: "Review quiet pairs",
      ctaHref: `${ADMIN_BASE}&tab=needs-attention`,
      icon: "clock",
      tone: "brand",
    };
  }
  if (summary.relationshipsWithoutGoals > 0) {
    const n = summary.relationshipsWithoutGoals;
    return {
      eyebrow: "Finish setup",
      title: `${n} pair${n === 1 ? "" : "s"} have no active G&R`,
      reason:
        "Goals & resources anchor every cycle — these relationships can't be reviewed until their G&R exists.",
      ctaLabel: "See what's missing",
      ctaHref: `${ADMIN_BASE}&tab=needs-attention`,
      icon: "flag",
      tone: "brand",
    };
  }
  if (summary.stalledGoals > 0) {
    const n = summary.stalledGoals;
    return {
      eyebrow: "Unblock",
      title: `${n} goal${n === 1 ? "" : "s"} are stalled`,
      reason:
        "Overdue or blocked goals with no recent progress. Surface them to the mentors who can help.",
      ctaLabel: "Review stalled goals",
      ctaHref: `${ADMIN_BASE}&tab=needs-attention`,
      icon: "hourglass",
      tone: "brand",
    };
  }
  return {
    eyebrow: "All clear",
    title: "The program is healthy",
    reason:
      "No unstaffed mentees, pending approvals, quiet pairs, or stalled goals right now. Open the cockpit for the full picture.",
    ctaLabel: "Open the cockpit",
    ctaHref: `${ADMIN_BASE}&tab=overview`,
    icon: "check",
    tone: "success",
  };
}

/** Map the raw action queue into a short, calm list (newest urgency first). */
export function toTriageItems(
  actionItems: AdminActionItem[],
  limit = 5
): TriageItem[] {
  return [...actionItems]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
    .map((item) => {
      const meta = KIND_META[item.kind];
      return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        href: item.href,
        badge: meta.badge,
        tone: meta.tone,
        icon: meta.icon,
      };
    });
}

export function AdminMentorshipTriage({
  focus,
  items,
  openCount,
}: {
  focus: TriageFocus;
  items: TriageItem[];
  openCount: number;
}) {
  return (
    <section aria-label="Mentorship triage" className="flex flex-col gap-4">
      <PrimaryFocusCard
        eyebrow={focus.eyebrow}
        icon={focus.icon}
        title={focus.title}
        reason={focus.reason}
        tone={focus.tone}
        ctaLabel={focus.ctaLabel}
        ctaHref={focus.ctaHref}
      />

      {items.length > 0 ? (
        <SimpleListCard title={`Needs attention (${openCount})`}>
          {items.map((item) => (
            <SimpleRow
              key={item.id}
              href={item.href}
              icon={item.icon}
              name={item.title}
              what={item.detail}
              status={{ label: item.badge, tone: item.tone }}
            />
          ))}
        </SimpleListCard>
      ) : (
        <EmptySimpleState icon="check">
          Nothing is flagged across the program right now — the queues are clear.
        </EmptySimpleState>
      )}
    </section>
  );
}
