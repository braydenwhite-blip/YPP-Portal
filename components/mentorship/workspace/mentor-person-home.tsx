import Link from "next/link";

import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

/**
 * Mentor home for one person — one next step, no door-card grid
 * (the tabs already cover G&R / Meetings / Feedback / Progress).
 */
export function MentorPersonHome({
  workspace,
  feedbackHref,
  progressHref,
}: {
  workspace: MentorshipWorkspace;
  goalsHref?: string;
  meetingsHref?: string;
  feedbackHref: string;
  progressHref?: string;
}) {
  const next = workspace.nextAction;
  const showWriteCta =
    next.key === "write-review" ||
    next.key === "revise-review" ||
    next.key === "record-mentor-check-in" ||
    next.key === "assign-goals";

  const writeHref = progressHref ?? `${feedbackHref.split("?")[0]}?section=progress`;
  const href =
    next.href ??
    (next.key === "write-review" || next.key === "revise-review"
      ? writeHref
      : feedbackHref);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      {showWriteCta && next.key !== "all-caught-up" ? (
        <Link
          href={href}
          className="rounded-[14px] border border-line bg-surface px-5 py-4 text-ink no-underline transition-colors hover:border-brand-300 hover:bg-surface-soft"
        >
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Next
          </p>
          <p className="m-0 mt-1 text-[16px] font-semibold text-ink">{next.label}</p>
          {next.reason ? (
            <p className="m-0 mt-1 text-[13px] text-ink-muted">{next.reason}</p>
          ) : null}
        </Link>
      ) : (
        <p className="m-0 text-[14px] text-ink-muted">
          Nothing waiting on you right now. Use the tabs above when you need them.
        </p>
      )}

      {(workspace.relationships.startedAtLabel ||
        workspace.relationships.lastConversationLabel) && (
        <p className="m-0 text-[12.5px] text-ink-muted">
          {[
            workspace.relationships.startedAtLabel
              ? `Started ${workspace.relationships.startedAtLabel}`
              : null,
            workspace.relationships.lastConversationLabel
              ? `Last talk ${workspace.relationships.lastConversationLabel}`
              : null,
            workspace.overview.mentorName && !workspace.isMentor
              ? `Mentor: ${workspace.overview.mentorName}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
