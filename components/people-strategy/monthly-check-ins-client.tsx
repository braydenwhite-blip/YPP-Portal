"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CheckInsDrawer } from "@/components/people-strategy/check-ins-drawer";
import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { Button, cn } from "@/components/ui-v2";
import { initialsFromName } from "@/lib/command-center/shared";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { sendSelfReflectionReminder } from "@/lib/people-strategy/check-in-actions";
import {
  CHECK_IN_WORKFLOW_STEPS,
  type MonthlyCheckInActionKind,
  type MonthlyCheckInQueueItem,
} from "@/lib/people-strategy/monthly-check-in-queue";
import { NO_RATING_COLOR, RATING_COLORS } from "@/lib/people-strategy/people-dashboard-selectors";
import type { GoalRatingColor } from "@prisma/client";

type Member = { id: string; name: string };

const AVATAR_HUES = ["#5a1da8", "#e07b2d", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

const EVALUATION_SCALE: Array<{ key: GoalRatingColor; description: string }> = [
  { key: "ABOVE_AND_BEYOND", description: "Exceeds expectations" },
  { key: "ACHIEVED", description: "Meeting goals" },
  { key: "GETTING_STARTED", description: "Some goals slipping" },
  { key: "BEHIND_SCHEDULE", description: "Intervention needed" },
];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

const STATUS_PILL_BY_LABEL: Record<string, string> = {
  "Drafting update": "bg-[#fdf8eb] text-[#8a5d00]",
  "Awaiting feedback": "bg-[#fdecea] text-[#c0392b]",
  "Ready for sign-off": "bg-[#eef4ff] text-[#1d4ed8]",
  "Self-reflection due": "bg-[#fdecea] text-[#c0392b]",
  "Meeting pending": "bg-[#f4f4f8] text-[#5c5c74]",
  "Up to date": "bg-[#ecfdf5] text-[#047857]",
};

function statusPillClass(item: MonthlyCheckInQueueItem): string {
  return STATUS_PILL_BY_LABEL[item.statusLabel] ?? "bg-[#f4f4f8] text-[#5c5c74]";
}

function actionButtonClass(kind: MonthlyCheckInActionKind): string {
  if (kind === "send-reminder") {
    return "border border-[#e8b4b0] bg-white text-[#c0392b] shadow-none hover:bg-[#fef8f7]";
  }
  if (kind === "request-feedback") {
    return "border border-[#dcd4f5] bg-[#f5f0ff] text-[#5a1da8] shadow-none hover:bg-[#ede8fb]";
  }
  return "border-0 bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] text-white shadow-none hover:opacity-95";
}

function WorkflowStepper() {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#ebebf2] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <div className="flex min-w-[760px] items-start">
        {CHECK_IN_WORKFLOW_STEPS.map((step, index) => (
          <div key={step.key} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-1 text-center">
              <span
                className={cn(
                  "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                  index < 2 && "bg-[#0e9f6e] text-white",
                  index === 2 && "bg-[#e0a008] text-white",
                  index > 2 && "bg-[#e8e8f0] text-[#9a9ab0]"
                )}
              >
                {index + 1}
              </span>
              <span className="text-[12.5px] font-bold leading-tight text-[#1c1a2e]">
                {step.title}
              </span>
              <span className="max-w-[140px] text-[11px] leading-snug text-[#9a9ab0]">
                {step.description}
              </span>
            </div>
            {index < CHECK_IN_WORKFLOW_STEPS.length - 1 ? (
              <div
                aria-hidden
                className="mt-[15px] h-px min-w-[12px] flex-[0.35] bg-[#e8e8f0]"
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ratingBarColor(rating: GoalRatingColor | null): string {
  return rating ? RATING_COLORS[rating].dot : NO_RATING_COLOR.dot;
}

function ratingBarLabel(rating: GoalRatingColor | null): string {
  return rating ? RATING_LABELS[rating] : NO_RATING_COLOR.label;
}

/** One row in the mockup-style check-in queue. */
function QueueRow({
  item,
  onAction,
  reminderSent,
  reminderPending,
}: {
  item: MonthlyCheckInQueueItem;
  onAction: (item: MonthlyCheckInQueueItem) => void;
  reminderSent: boolean;
  reminderPending: boolean;
}) {
  const initials = initialsFromName(item.name);
  const mentorLine = item.mentorName
    ? `Mentor ${item.mentorName} · meeting ${item.meetingLabel}`
    : `No mentor · meeting ${item.meetingLabel}`;

  return (
    <article className="grid grid-cols-1 items-center gap-x-6 gap-y-3 border-b border-[#f4f4f8] px-5 py-[18px] last:border-b-0 md:grid-cols-[minmax(200px,240px)_1fr_148px]">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: avatarHue(item.name) }}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="m-0 truncate text-[15px] font-bold text-[#1c1a2e]">{item.name}</p>
          <p className="m-0 mt-0.5 truncate text-[12.5px] text-[#9a9ab0]">{mentorLine}</p>
        </div>
      </div>

      <div className="min-w-0 md:px-1">
        <span
          role="img"
          aria-label={`Performance: ${ratingBarLabel(item.performanceRating)}`}
          className="block h-[7px] w-full rounded-[3px]"
          style={{ background: ratingBarColor(item.performanceRating) }}
          title={ratingBarLabel(item.performanceRating)}
        />
        {item.detailText ? (
          <p className="m-0 mt-2 text-[12px] leading-snug text-[#717189]">{item.detailText}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-stretch gap-2">
        <span
          className={cn(
            "self-end rounded-full px-3 py-1 text-[11.5px] font-semibold whitespace-nowrap",
            statusPillClass(item)
          )}
        >
          {item.statusLabel}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            "h-[34px] w-full rounded-lg px-3 text-[12px] font-semibold",
            item.actionKind === "send-reminder" && reminderSent
              ? "border border-[#a7f3d0] bg-[#ecfdf5] text-[#0e7c52] shadow-none hover:bg-[#ecfdf5]"
              : actionButtonClass(item.actionKind)
          )}
          disabled={item.actionKind === "send-reminder" && (reminderPending || reminderSent)}
          onClick={() => onAction(item)}
        >
          {item.actionKind === "send-reminder" && reminderPending
            ? "Sending…"
            : item.actionKind === "send-reminder" && reminderSent
              ? "Reminder sent"
              : item.actionLabel}
        </Button>
      </div>
    </article>
  );
}

function EvaluationScale() {
  return (
    <section className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
        Evaluation scale
      </h2>
      <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
        {EVALUATION_SCALE.map(({ key, description }) => {
          const meta = RATING_COLORS[key];
          return (
            <li key={key} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-0.5 size-3 shrink-0 rounded-full"
                style={{ background: meta.dot }}
              />
              <span>
                <span className="block text-[13px] font-semibold text-[#1c1a2e]">
                  {RATING_LABELS[key]}
                </span>
                <span className="text-[12px] text-[#9a9ab0]">{description}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-4 text-[11.5px] leading-relaxed text-[#9a9ab0]">
        Every 3 months, this expands into a full Quarterly Review.
      </p>
    </section>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M2.94 5.5A2 2 0 0 1 4.5 4h11a2 2 0 0 1 1.56.75L10 10.5 2.94 5.5ZM2 7.07V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.07l-7.47 5.23a2 2 0 0 1-2.06 0L2 7.07Z" />
    </svg>
  );
}

function FeedbackRequestCard({ onPreview }: { onPreview: () => void }) {
  return (
    <section className="rounded-[14px] border border-[#e4d8f7] bg-[#faf7ff] p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#5a1da8]">
        Request monthly feedback
      </h2>
      <p className="m-0 mt-3 text-[12.5px] leading-relaxed text-[#5c5c74]">
        Send collaborator feedback requests to the People Chair. Responses stay
        private from the member until compiled into the check-in.
      </p>
      <Button
        variant="primary"
        size="sm"
        className="mt-4 inline-flex w-full items-center justify-center border-0 bg-gradient-to-br from-[#5a1da8] via-[#6b21c8] to-[#8b3fe8] shadow-none hover:opacity-95"
        onClick={onPreview}
      >
        <MailIcon className="mr-1.5 size-4" />
        Preview feedback emails
      </Button>
    </section>
  );
}

export function MonthlyCheckInsClient({
  queue,
  monthQueueLabel,
  currentMonthKey,
}: {
  queue: MonthlyCheckInQueueItem[];
  monthQueueLabel: string;
  currentMonthKey: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [checkInsMember, setCheckInsMember] = useState<Member | null>(null);
  const [reviewMember, setReviewMember] = useState<Member | null>(null);
  const [requestMember, setRequestMember] = useState<Member | null>(null);
  const [reminderSentIds, setReminderSentIds] = useState<Set<string>>(new Set());
  const [reminderTargetId, setReminderTargetId] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  function sendReminder(item: MonthlyCheckInQueueItem) {
    setReminderError(null);
    setReminderTargetId(item.personId);
    startTransition(async () => {
      try {
        await sendSelfReflectionReminder({
          userId: item.personId,
          month: new Date(`${currentMonthKey}-01T00:00:00.000Z`),
        });
        setReminderSentIds((prev) => new Set(prev).add(item.personId));
        router.refresh();
      } catch (err) {
        setReminderError(
          err instanceof Error ? err.message : "Could not send reminder."
        );
      } finally {
        setReminderTargetId(null);
      }
    });
  }

  function dispatchAction(item: MonthlyCheckInQueueItem) {
    const member = { id: item.personId, name: item.name };
    switch (item.actionKind) {
      case "request-feedback":
        setRequestMember(member);
        break;
      case "review-feedback":
      case "await-feedback":
        setReviewMember(member);
        break;
      case "send-reminder":
        sendReminder(item);
        break;
      case "open-check-ins":
      case "compile-check-in":
        setCheckInsMember(member);
        break;
      default:
        setCheckInsMember(member);
        break;
    }
  }

  const firstNeedsFeedback = queue.find(
    (q) => q.actionKind === "request-feedback" || q.statusLabel === "Awaiting feedback"
  );

  return (
    <>
      <WorkflowStepper />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_292px]">
        <section className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <header className="border-b border-[#f1f1f6] px-5 py-3.5">
            <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
              {monthQueueLabel} check-in queue
            </h2>
          </header>
          {queue.length === 0 ? (
            <p className="m-0 px-5 py-12 text-center text-[13px] text-[#9a9ab0]">
              No one in the queue yet for this month.
            </p>
          ) : (
            queue.map((item) => (
              <QueueRow
                key={item.personId}
                item={item}
                onAction={dispatchAction}
                reminderSent={reminderSentIds.has(item.personId)}
                reminderPending={pending && reminderTargetId === item.personId}
              />
            ))
          )}
        </section>

        <aside className="flex flex-col gap-4">
          {reminderError ? (
            <p className="m-0 rounded-[10px] border border-[#fdecea] bg-[#fef8f7] px-3 py-2 text-[12.5px] text-[#c0392b]">
              {reminderError}
            </p>
          ) : null}
          <EvaluationScale />
          <FeedbackRequestCard
            onPreview={() => {
              if (firstNeedsFeedback) {
                setRequestMember({
                  id: firstNeedsFeedback.personId,
                  name: firstNeedsFeedback.name,
                });
              } else if (queue[0]) {
                setRequestMember({ id: queue[0].personId, name: queue[0].name });
              }
            }}
          />
        </aside>
      </div>

      <CheckInsDrawer member={checkInsMember} onClose={() => setCheckInsMember(null)} />
      <FeedbackReviewDrawer member={reviewMember} onClose={() => setReviewMember(null)} />
      <FeedbackRequestDrawer member={requestMember} onClose={() => setRequestMember(null)} />
    </>
  );
}
