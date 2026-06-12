import Link from "next/link";
import {
  completeApplicationInterviewAndNote,
  confirmInterviewSlot,
  saveStructuredInterviewNote,
} from "@/lib/application-actions";
import {
  completeInstructorInterviewAndSetOutcome,
  confirmPostedInterviewSlot,
} from "@/lib/instructor-interview-actions";
import { StatusBadge, type StatusBadgeTone } from "@/components/interviews/ui";
import { Button, EntityChip, buttonVariants, cn } from "@/components/ui-v2";
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewTaskCardProps = {
  task: InterviewTask;
};

const INLINE_FORM_KINDS = new Set([
  "complete_hiring_interview_and_note",
  "add_hiring_recommendation_note",
  "complete_readiness_interview_and_outcome",
]);

/** Shared Tailwind vocabulary for the inline capture forms. */
const FIELD_LABEL =
  "flex flex-col gap-1 text-[12.5px] font-semibold text-ink";
const FIELD_INPUT =
  "rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-normal text-ink outline-none focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-400/30";

function stageLabel(stage: InterviewTask["stage"]) {
  if (stage === "NEEDS_ACTION") return "Needs Action";
  if (stage === "SCHEDULED") return "Scheduled";
  if (stage === "COMPLETED") return "Completed";
  return "Blocked";
}

function stageTone(stage: InterviewTask["stage"]): StatusBadgeTone {
  if (stage === "NEEDS_ACTION") return "needs-action";
  if (stage === "COMPLETED") return "completed";
  if (stage === "BLOCKED") return "blocked";
  return "scheduled";
}

function domainLabel(domain: InterviewTask["domain"]) {
  return domain === "HIRING" ? "Hiring" : "Readiness";
}

function formatRelative(date: Date | null | undefined) {
  if (!date) return null;
  const ts = new Date(date);
  const now = Date.now();
  const diff = ts.getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let value: string;
  if (minutes < 1) value = "now";
  else if (minutes < 60) value = `${minutes}m`;
  else if (hours < 24) value = `${hours}h`;
  else value = `${days}d`;
  if (Math.abs(minutes) < 1) return "just now";
  return diff >= 0 ? `in ${value}` : `${value} ago`;
}

function schedulingDetail(task: InterviewTask): string | null {
  const s = task.schedulingStatus;
  if (!s) return null;

  if (s.state === "TIMES_SENT") {
    const parts: string[] = [];
    if (s.slotCount && s.slotCount > 1) parts.push(`${s.slotCount} times offered`);
    else parts.push("Time offered");
    if (s.sentByName) parts.push(`by ${s.sentByName}`);
    const when = formatRelative(s.sentAt);
    if (when) parts.push(when);
    return parts.join(" · ");
  }

  if (s.state === "AWAITING_TIMES") {
    return s.sentToName ? `No interview times sent to ${s.sentToName} yet` : null;
  }

  if (s.state === "CONFIRMED") {
    return null;
  }

  return null;
}

function timestampHelper(task: InterviewTask) {
  const ts = task.timestamps;
  if (!ts) return null;
  if (task.stage === "SCHEDULED" && ts.scheduledAt) {
    return `Interview ${formatRelative(ts.scheduledAt)} · ${new Date(ts.scheduledAt).toLocaleString(
      [],
      { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    )}`;
  }
  if (task.stage === "COMPLETED" && ts.completedAt) {
    return `Completed ${formatRelative(ts.completedAt)}`;
  }
  if (ts.submittedAt) {
    return `Submitted ${formatRelative(ts.submittedAt)}`;
  }
  return null;
}

const PRIMARY_LINK_CLASS = cn(buttonVariants({ variant: "primary", size: "sm" }), "no-underline");
const SECONDARY_LINK_CLASS = cn(buttonVariants({ variant: "secondary", size: "sm" }), "no-underline");

function InlineFormDisclosure({
  open,
  summaryLabel,
  children,
}: {
  open: boolean;
  summaryLabel: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group" open={open}>
      <summary className="inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className={PRIMARY_LINK_CLASS}>{summaryLabel}</span>
      </summary>
      {children}
    </details>
  );
}

function renderPrimaryAction(task: InterviewTask, formId: string) {
  const action = task.primaryAction;

  if (action.kind === "open_details") {
    return (
      <Link href={action.href} className={PRIMARY_LINK_CLASS}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "confirm_hiring_slot") {
    return (
      <form action={confirmInterviewSlot}>
        <input type="hidden" name="slotId" value={action.slotId} />
        <Button type="submit" variant="primary" size="sm">
          {action.label}
        </Button>
      </form>
    );
  }

  if (action.kind === "post_hiring_slots_bulk") {
    return (
      <Link href="/interviews/schedule" className={PRIMARY_LINK_CLASS}>
        Open Interview Scheduler
      </Link>
    );
  }

  if (action.kind === "complete_hiring_interview_and_note") {
    return (
      <InlineFormDisclosure open={task.stage === "NEEDS_ACTION"} summaryLabel={action.label}>
        <form
          id={formId}
          action={completeApplicationInterviewAndNote}
          className="mt-3 flex flex-col gap-3"
        >
          <input type="hidden" name="applicationId" value={action.applicationId} />
          <input type="hidden" name="slotId" value={action.slotId} />
          <label className={FIELD_LABEL}>
            Recommendation
            <select name="recommendation" className={FIELD_INPUT} defaultValue="YES">
              <option value="STRONG_YES">Strong Yes</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label className={FIELD_LABEL}>
            Interview Note Summary
            <textarea
              name="content"
              className={FIELD_INPUT}
              rows={3}
              required
              placeholder="Key signals, strengths, concerns, and recommendation rationale..."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={FIELD_LABEL}>
              Strengths (optional)
              <textarea name="strengths" className={FIELD_INPUT} rows={2} placeholder="Observed strengths..." />
            </label>
            <label className={FIELD_LABEL}>
              Concerns (optional)
              <textarea name="concerns" className={FIELD_INPUT} rows={2} placeholder="Potential risks or follow-ups..." />
            </label>
          </div>
          <div>
            <Button type="submit" variant="primary" size="sm">
              {action.label}
            </Button>
          </div>
        </form>
      </InlineFormDisclosure>
    );
  }

  if (action.kind === "add_hiring_recommendation_note") {
    return (
      <InlineFormDisclosure open={task.stage === "NEEDS_ACTION"} summaryLabel={action.label}>
        <form
          id={formId}
          action={saveStructuredInterviewNote}
          className="mt-3 flex flex-col gap-3"
        >
          <input type="hidden" name="applicationId" value={action.applicationId} />
          <label className={FIELD_LABEL}>
            Recommendation
            <select name="recommendation" className={FIELD_INPUT} defaultValue="YES">
              <option value="STRONG_YES">Strong Yes</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label className={FIELD_LABEL}>
            Interview Note Summary
            <textarea
              name="content"
              className={FIELD_INPUT}
              rows={3}
              required
              placeholder="Add recommendation details so decision can move forward..."
            />
          </label>
          <div>
            <Button type="submit" variant="primary" size="sm">
              {action.label}
            </Button>
          </div>
        </form>
      </InlineFormDisclosure>
    );
  }

  if (action.kind === "confirm_readiness_slot") {
    return (
      <form action={confirmPostedInterviewSlot}>
        <input type="hidden" name="slotId" value={action.slotId} />
        <Button type="submit" variant="primary" size="sm">
          {action.label}
        </Button>
      </form>
    );
  }

  if (
    action.kind === "request_readiness_availability" ||
    action.kind === "post_readiness_slots_bulk" ||
    action.kind === "accept_readiness_request"
  ) {
    return (
      <Link href="/interviews/schedule" className={PRIMARY_LINK_CLASS}>
        Open Interview Scheduler
      </Link>
    );
  }

  return (
    <InlineFormDisclosure open={task.stage === "NEEDS_ACTION"} summaryLabel={action.label}>
      <form
        id={formId}
        action={completeInstructorInterviewAndSetOutcome}
        className="mt-3 flex flex-col gap-3"
      >
        <input type="hidden" name="gateId" value={action.gateId} />
        {action.slotId ? <input type="hidden" name="slotId" value={action.slotId} /> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={FIELD_LABEL}>
            Outcome
            <select name="outcome" className={FIELD_INPUT} defaultValue="PASS">
              <option value="PASS">PASS</option>
              <option value="HOLD">HOLD</option>
              <option value="FAIL">FAIL</option>
              <option value="WAIVE">WAIVE (Admin only)</option>
            </select>
          </label>
          <label className={FIELD_LABEL}>
            Notes
            <input name="reviewNotes" className={FIELD_INPUT} placeholder="Outcome notes or follow-up steps..." />
          </label>
        </div>
        <div>
          <Button type="submit" variant="primary" size="sm">
            {action.label}
          </Button>
        </div>
      </form>
    </InlineFormDisclosure>
  );
}

export default function InterviewTaskCard({ task }: InterviewTaskCardProps) {
  const isAccent = task.stage === "NEEDS_ACTION";
  const helper = timestampHelper(task);
  const hasInlineForm = INLINE_FORM_KINDS.has(task.primaryAction.kind);
  const formId = `iv-task-${task.id}-form`;
  const scheduling = task.schedulingStatus;
  const schedulingHelper = schedulingDetail(task);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card",
        isAccent && "border-l-4 border-l-brand-600"
      )}
      aria-labelledby={`${formId}-title`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              {domainLabel(task.domain)}
            </span>
            <StatusBadge tone={stageTone(task.stage)}>{stageLabel(task.stage)}</StatusBadge>
            {scheduling ? (
              <StatusBadge tone={scheduling.tone}>{scheduling.label}</StatusBadge>
            ) : null}
          </div>
          <h4
            id={`${formId}-title`}
            className="mt-1.5 text-[15px] font-bold leading-snug text-ink"
          >
            {task.title}
          </h4>
          <p className="mt-0.5 text-[13px] text-ink-muted">{task.subtitle}</p>
          {schedulingHelper ? (
            <p className="mt-1 text-[12.5px] font-medium text-warning-700">{schedulingHelper}</p>
          ) : null}
          {helper ? <p className="mt-1 text-[12.5px] text-ink-muted">{helper}</p> : null}
          {task.relatedEntity ? (
            <div className="mt-2">
              <EntityChip
                type={task.relatedEntity.type}
                id={task.relatedEntity.id}
                label={task.relatedEntity.label}
              />
            </div>
          ) : null}
        </div>
        {!hasInlineForm ? (
          <div className="shrink-0">{renderPrimaryAction(task, formId)}</div>
        ) : null}
      </div>

      {task.detail ? (
        <p className="text-[13px] leading-relaxed text-ink">{task.detail}</p>
      ) : null}

      {hasInlineForm ? (
        <div className="rounded-[10px] border border-line-soft bg-surface-soft p-4">
          {renderPrimaryAction(task, formId)}
        </div>
      ) : null}

      {(task.blockers.length > 0 || task.secondaryLinks.length > 0) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line-soft pt-3">
          {task.blockers.length > 0 ? (
            <div
              className="flex flex-col gap-1 text-[12.5px] text-danger-700"
              role="note"
            >
              <span className="font-bold uppercase tracking-[0.06em]">Blocked</span>
              <ul className="m-0 list-disc pl-4">
                {task.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {task.secondaryLinks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {task.secondaryLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className={SECONDARY_LINK_CLASS}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}
