import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import { getSessionUser } from "@/lib/auth-supabase";
import { getActionsForEntity } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import type { WorkspaceCommitment } from "@/lib/mentorship/workspace";

/**
 * "Their open work this cycle" — read-only evidence for the review writer and
 * the quarterly committee: the person's canonical Action Tracker items (open +
 * recently completed) and their mentorship follow-up commitments, each with an
 * overdue flag. A compact list, not a dashboard — it grounds the review in
 * what the person actually has on their plate. Renders nothing when there is
 * no work to show (and Action Tracker items disappear silently when the
 * tracker flag is off — getActionsForEntity returns [] then).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENTLY_COMPLETED_MS = 30 * DAY_MS;

const ACTION_STATUS_TONE: Record<string, StatusTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  COMPLETE: "success",
  OVERDUE: "danger",
  BLOCKED: "danger",
};

const ACTION_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETE: "Done",
  OVERDUE: "Overdue",
  BLOCKED: "Blocked",
};

export async function LinkedWorkEvidence({
  menteeId,
  commitments,
}: {
  menteeId: string;
  commitments: WorkspaceCommitment[];
}) {
  // Build the viewer the same way /people/[id] does for its operating panels —
  // visibility filtering happens inside getActionsForEntity, so this never
  // shows an action the current viewer couldn't open at /actions/[id].
  const sessionUser = await getSessionUser();
  const viewer: ActionViewer | null = sessionUser
    ? {
        id: sessionUser.id,
        roles: sessionUser.roles,
        primaryRole: sessionUser.primaryRole,
        adminSubtypes: sessionUser.adminSubtypes,
      }
    : null;

  const now = Date.now();
  const allActions = viewer
    ? await getActionsForEntity("USER", menteeId, viewer).catch(() => [])
    : [];
  const actions = allActions.filter((item) => {
    if (item.status === "DROPPED") return false;
    if (item.status === "COMPLETE") {
      return !!item.completedAt && now - item.completedAt.getTime() <= RECENTLY_COMPLETED_MS;
    }
    return true;
  });

  const openCommitments = commitments.filter((c) => !c.completed);

  if (actions.length === 0 && openCommitments.length === 0) return null;

  return (
    <section className="rounded-[12px] border border-line-soft bg-surface-soft px-4 py-3">
      <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
        Their open work this cycle
      </p>
      {actions.length > 0 ? (
        <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {actions.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <a
                href={`/actions/${item.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {item.title}
              </a>
              <StatusBadge tone={ACTION_STATUS_TONE[item.status] ?? "neutral"}>
                {ACTION_STATUS_LABEL[item.status] ?? item.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      ) : null}
      {openCommitments.length > 0 ? (
        <>
          <p className="m-0 mt-3 text-[11.5px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Follow-up commitments
          </p>
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1.5 p-0">
            {openCommitments.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-ink">{c.title}</span>
                {c.dueLabel ? (
                  <span className={c.overdue ? "font-semibold text-danger-700" : "text-ink-muted"}>
                    {c.overdue ? "overdue — " : "due "}
                    {c.dueLabel}
                  </span>
                ) : null}
                {c.fromReviewLabel ? (
                  <span className="text-[12px] text-ink-muted">· {c.fromReviewLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
