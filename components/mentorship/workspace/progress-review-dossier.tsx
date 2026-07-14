import type { ReactNode } from "react";
import Link from "next/link";

import { CardV2 } from "@/components/ui-v2";
import { getSessionUser } from "@/lib/auth-supabase";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import {
  ensureCurrentMonthForm,
  pastMonthlyForms,
  readMonthlyFeedbackStore,
} from "@/lib/mentorship/feedback-prompts";
import { getGoalsForMentee } from "@/lib/mentorship-gr-binding";
import {
  getActionsForEntity,
  getMyActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENTLY_COMPLETED_MS = 60 * DAY_MS;

function viewerFromSession(
  session: Awaited<ReturnType<typeof getSessionUser>>
): ActionViewer | null {
  if (!session) return null;
  return {
    id: session.id,
    roles: session.roles,
    primaryRole: session.primaryRole,
    adminSubtypes: session.adminSubtypes,
  };
}

function keepAction(item: ActionItemWithRelations, now: number): boolean {
  if (item.status === "DROPPED") return false;
  if (item.status === "COMPLETE") {
    return !!item.completedAt && now - item.completedAt.getTime() <= RECENTLY_COMPLETED_MS;
  }
  return true;
}

function snippet(text: string | null | undefined, max = 120): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max).trim()}…`;
}

/**
 * Quick evidence before writing a progress update — compact, scannable,
 * expandable only when the mentor wants detail.
 */
export async function ProgressReviewDossier({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  try {
    return await renderProgressReviewDossier(workspace);
  } catch {
    return null;
  }
}

async function renderProgressReviewDossier(workspace: MentorshipWorkspace) {
  const { person, checkIns, commitments, activeMentorshipId } = workspace;
  const first = person.name.trim().split(/\s+/)[0] || "They";
  const sessionUser = await getSessionUser();
  const viewer = viewerFromSession(sessionUser);
  const now = Date.now();

  const [involved, userLinked, mentorshipLinked, liveGoals, mentorshipRow] =
    await Promise.all([
      viewer
        ? getMyActionItems(person.id, viewer).catch(() => [] as ActionItemWithRelations[])
        : Promise.resolve([] as ActionItemWithRelations[]),
      viewer
        ? getActionsForEntity("USER", person.id, viewer).catch(
            () => [] as ActionItemWithRelations[]
          )
        : Promise.resolve([] as ActionItemWithRelations[]),
      viewer && activeMentorshipId
        ? getActionsForEntity("MENTORSHIP", activeMentorshipId, viewer).catch(
            () => [] as ActionItemWithRelations[]
          )
        : Promise.resolve([] as ActionItemWithRelations[]),
      getGoalsForMentee(person.id),
      activeMentorshipId
        ? prisma.mentorship.findUnique({
            where: { id: activeMentorshipId },
            select: { customPromptsJson: true },
          })
        : Promise.resolve(null),
    ]);

  const byId = new Map<string, ActionItemWithRelations>();
  for (const item of [...involved, ...userLinked, ...mentorshipLinked]) {
    if (!keepAction(item, now)) continue;
    byId.set(item.id, item);
  }
  const actions = Array.from(byId.values()).sort((a, b) => {
    const aDone = a.status === "COMPLETE" ? 1 : 0;
    const bDone = b.status === "COMPLETE" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  });

  const openActions = actions.filter((a) => a.status !== "COMPLETE");
  const openCommitments = commitments.filter((c) => !c.completed);
  const recentMeeting = checkIns[0] ?? null;

  const feedbackStore = readMonthlyFeedbackStore(mentorshipRow?.customPromptsJson);
  const ensured = ensureCurrentMonthForm(feedbackStore);
  const past = pastMonthlyForms(ensured.store, ensured.current.cycleMonthKey);
  const feedbackForms = [ensured.current, ...past].filter(
    (f) => f.status === "ANSWERED" || f.status === "SENT"
  );
  const latestFeedback = feedbackForms[0] ?? null;
  const answeredCount =
    latestFeedback?.status === "ANSWERED"
      ? latestFeedback.questions.filter((q) => q.answer?.trim()).length
      : 0;

  const hasWork =
    openActions.length > 0 ||
    openCommitments.length > 0 ||
    liveGoals.length > 0 ||
    checkIns.length > 0 ||
    latestFeedback != null;

  if (!hasWork) {
    return (
      <CardV2 padding="md" className="border border-line-soft bg-surface-soft">
        <p className="m-0 text-[13.5px] text-ink-muted">
          Nothing logged for {first} this month yet. Check{" "}
          <Link
            href={`/mentorship/people/${person.id}?section=goals`}
            className="font-semibold text-brand-700 no-underline hover:underline"
          >
            Goals
          </Link>
          ,{" "}
          <Link
            href={`/mentorship/people/${person.id}?section=check-ins`}
            className="font-semibold text-brand-700 no-underline hover:underline"
          >
            Meetings
          </Link>
          , or{" "}
          <Link
            href={`/mentorship/people/${person.id}?section=reviews`}
            className="font-semibold text-brand-700 no-underline hover:underline"
          >
            Feedback
          </Link>{" "}
          — then come back to write the update.
        </p>
      </CardV2>
    );
  }

  const chips: string[] = [];
  if (liveGoals.length > 0) chips.push(`${liveGoals.length} goal${liveGoals.length === 1 ? "" : "s"}`);
  if (openActions.length > 0) {
    chips.push(`${openActions.length} action${openActions.length === 1 ? "" : "s"}`);
  }
  if (checkIns.length > 0) {
    chips.push(`${checkIns.length} meeting${checkIns.length === 1 ? "" : "s"}`);
  }
  if (answeredCount > 0) chips.push(`${answeredCount} feedback answer${answeredCount === 1 ? "" : "s"}`);

  return (
    <CardV2 padding="md" className="flex flex-col gap-3">
      <div>
        <p className="m-0 text-[14px] font-semibold text-ink">
          Quick look at {first}&apos;s month
        </p>
        {chips.length > 0 ? (
          <p className="m-0 mt-1 text-[13px] text-ink-muted">{chips.join(" · ")}</p>
        ) : null}
      </div>

      {latestFeedback?.status === "ANSWERED" && answeredCount > 0 ? (
        <EvidenceBlock
          title={`What ${first} said (${latestFeedback.cycleLabel})`}
          defaultOpen
          href={`/mentorship/people/${person.id}?section=reviews`}
        >
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {latestFeedback.questions
              .filter((q) => q.answer?.trim())
              .slice(0, 4)
              .map((q) => (
                <li key={q.id}>
                  <p className="m-0 text-[12.5px] font-medium text-ink-muted">{q.text}</p>
                  <p className="m-0 mt-0.5 text-[13.5px] leading-relaxed text-ink">
                    {snippet(q.answer, 200)}
                  </p>
                </li>
              ))}
          </ul>
        </EvidenceBlock>
      ) : latestFeedback?.status === "SENT" ? (
        <p className="m-0 rounded-[10px] bg-surface-soft px-3 py-2 text-[13px] text-ink-muted">
          Feedback sent — waiting on {first}&apos;s answers.
        </p>
      ) : null}

      {openActions.length > 0 || openCommitments.length > 0 ? (
        <EvidenceBlock
          title={`Open work (${openActions.length + openCommitments.length})`}
          href="/actions"
        >
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {openActions.slice(0, 6).map((item) => (
              <li key={item.id} className="text-[13.5px]">
                <Link
                  href={`/actions/${item.id}`}
                  className="font-medium text-brand-700 no-underline hover:underline"
                >
                  {item.title}
                </Link>
                {item.deadlineEnd ? (
                  <span className="ml-2 text-[12px] text-ink-muted">
                    due{" "}
                    {item.deadlineEnd.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                ) : null}
              </li>
            ))}
            {openCommitments.slice(0, 4).map((c) => (
              <li key={c.id} className="text-[13.5px] text-ink">
                {c.title}
                {c.overdue ? (
                  <span className="ml-2 text-[12px] font-semibold text-danger-700">
                    overdue
                  </span>
                ) : c.dueLabel ? (
                  <span className="ml-2 text-[12px] text-ink-muted">due {c.dueLabel}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </EvidenceBlock>
      ) : null}

      {liveGoals.length > 0 ? (
        <EvidenceBlock
          title={`Goals (${liveGoals.length})`}
          href={`/mentorship/people/${person.id}?section=goals`}
        >
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {liveGoals.slice(0, 5).map((g) => (
              <li key={g.id} className="text-[13.5px] text-ink">
                {g.title}
              </li>
            ))}
          </ul>
        </EvidenceBlock>
      ) : null}

      {recentMeeting ? (
        <EvidenceBlock
          title="Latest meeting"
          href={`/mentorship/people/${person.id}?section=check-ins`}
        >
          <p className="m-0 text-[12px] text-ink-muted">{recentMeeting.dateLabel}</p>
          <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-ink">
            {snippet(
              recentMeeting.wins || recentMeeting.discussion || recentMeeting.notes,
              180
            ) ?? "Logged — open Meetings for notes."}
          </p>
        </EvidenceBlock>
      ) : null}
    </CardV2>
  );
}

function EvidenceBlock({
  title,
  href,
  defaultOpen = false,
  children,
}: {
  title: string;
  href?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-[10px] border border-line-soft bg-surface-soft"
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </summary>
      <div className="border-t border-line-soft px-3.5 py-2.5">
        {children}
        {href ? (
          <p className="m-0 mt-2.5">
            <Link
              href={href}
              className="text-[12px] font-semibold text-brand-700 no-underline hover:underline"
            >
              Open in portal →
            </Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
