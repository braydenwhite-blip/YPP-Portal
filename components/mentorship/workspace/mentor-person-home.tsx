import Link from "next/link";

import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

/**
 * Mentor/leadership home for someone else's workspace — three obvious doors.
 * The next-step card sits above this in the workspace shell.
 */
export function MentorPersonHome({
  workspace,
  goalsHref,
  meetingsHref,
  feedbackHref,
}: {
  workspace: MentorshipWorkspace;
  goalsHref: string;
  meetingsHref: string;
  feedbackHref: string;
}) {
  const meetings = workspace.checkIns.length;
  const goalsReady = workspace.goals.docStatus === "ACTIVE";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Door
          href={goalsHref}
          title="Goals"
          detail={
            goalsReady
              ? `${workspace.goals.activeGoals} open`
              : "Not set up yet"
          }
        />
        <Door
          href={meetingsHref}
          title="Meetings"
          detail={meetings === 0 ? "Log a meeting" : `${meetings} logged`}
        />
        <Door href={feedbackHref} title="Feedback" detail="Notes & check-ins" />
      </div>

      {(workspace.relationships.startedAtLabel ||
        workspace.relationships.lastConversationLabel) && (
        <p className="m-0 text-[13px] text-ink-muted">
          {[
            workspace.relationships.startedAtLabel
              ? `Started ${workspace.relationships.startedAtLabel}`
              : null,
            workspace.relationships.lastConversationLabel
              ? `Last talk ${workspace.relationships.lastConversationLabel}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function Door({
  href,
  title,
  detail,
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-2xl border border-border bg-surface px-5 py-6 text-ink no-underline shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className="text-[22px] font-semibold tracking-tight text-ink group-hover:text-brand-800">
        {title}
      </span>
      <span className="text-[13px] text-ink-muted">{detail}</span>
      <span className="mt-3 text-[13px] font-semibold text-brand-700">Open →</span>
    </Link>
  );
}
