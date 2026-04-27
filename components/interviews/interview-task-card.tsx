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
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewTaskCardProps = {
  task: InterviewTask;
};

const INLINE_FORM_KINDS = new Set([
  "complete_hiring_interview_and_note",
  "add_hiring_recommendation_note",
  "complete_readiness_interview_and_outcome",
]);

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

function renderPrimaryAction(task: InterviewTask, formId: string) {
  const action = task.primaryAction;

  if (action.kind === "open_details") {
    return (
      <Link href={action.href} className="button small" style={{ textDecoration: "none" }}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "confirm_hiring_slot") {
    return (
      <form action={confirmInterviewSlot}>
        <input type="hidden" name="slotId" value={action.slotId} />
        <button type="submit" className="button small">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.kind === "post_hiring_slots_bulk") {
    return (
      <Link href="/interviews/schedule" className="button small" style={{ textDecoration: "none" }}>
        Open Interview Scheduler
      </Link>
    );
  }

  if (action.kind === "complete_hiring_interview_and_note") {
    return (
      <details className="iv-task-card-disclosure" open={task.stage === "NEEDS_ACTION"}>
        <summary className="iv-task-card-disclosure-summary">
          <span className="button small">{action.label}</span>
        </summary>
        <form
          id={formId}
          action={completeApplicationInterviewAndNote}
          className="form-grid"
          style={{ marginTop: 12 }}
        >
          <input type="hidden" name="applicationId" value={action.applicationId} />
          <input type="hidden" name="slotId" value={action.slotId} />
          <label className="form-row">
            Recommendation
            <select name="recommendation" className="input" defaultValue="YES">
              <option value="STRONG_YES">Strong Yes</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label className="form-row">
            Interview Note Summary
            <textarea
              name="content"
              className="input"
              rows={3}
              required
              placeholder="Key signals, strengths, concerns, and recommendation rationale..."
            />
          </label>
          <div className="grid two">
            <label className="form-row">
              Strengths (optional)
              <textarea name="strengths" className="input" rows={2} placeholder="Observed strengths..." />
            </label>
            <label className="form-row">
              Concerns (optional)
              <textarea name="concerns" className="input" rows={2} placeholder="Potential risks or follow-ups..." />
            </label>
          </div>
          <button type="submit" className="button small">
            {action.label}
          </button>
        </form>
      </details>
    );
  }

  if (action.kind === "add_hiring_recommendation_note") {
    return (
      <details className="iv-task-card-disclosure" open={task.stage === "NEEDS_ACTION"}>
        <summary className="iv-task-card-disclosure-summary">
          <span className="button small">{action.label}</span>
        </summary>
        <form
          id={formId}
          action={saveStructuredInterviewNote}
          className="form-grid"
          style={{ marginTop: 12 }}
        >
          <input type="hidden" name="applicationId" value={action.applicationId} />
          <label className="form-row">
            Recommendation
            <select name="recommendation" className="input" defaultValue="YES">
              <option value="STRONG_YES">Strong Yes</option>
              <option value="YES">Yes</option>
              <option value="MAYBE">Maybe</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label className="form-row">
            Interview Note Summary
            <textarea
              name="content"
              className="input"
              rows={3}
              required
              placeholder="Add recommendation details so decision can move forward..."
            />
          </label>
          <button type="submit" className="button small">
            {action.label}
          </button>
        </form>
      </details>
    );
  }

  if (action.kind === "confirm_readiness_slot") {
    return (
      <form action={confirmPostedInterviewSlot}>
        <input type="hidden" name="slotId" value={action.slotId} />
        <button type="submit" className="button small">
          {action.label}
        </button>
      </form>
    );
  }

  if (
    action.kind === "request_readiness_availability" ||
    action.kind === "post_readiness_slots_bulk" ||
    action.kind === "accept_readiness_request"
  ) {
    return (
      <Link href="/interviews/schedule" className="button small" style={{ textDecoration: "none" }}>
        Open Interview Scheduler
      </Link>
    );
  }

  return (
    <details className="iv-task-card-disclosure" open={task.stage === "NEEDS_ACTION"}>
      <summary className="iv-task-card-disclosure-summary">
        <span className="button small">{action.label}</span>
      </summary>
      <form
        id={formId}
        action={completeInstructorInterviewAndSetOutcome}
        className="form-grid"
        style={{ marginTop: 12 }}
      >
        <input type="hidden" name="gateId" value={action.gateId} />
        {action.slotId ? <input type="hidden" name="slotId" value={action.slotId} /> : null}
        <div className="grid two">
          <label className="form-row">
            Outcome
            <select name="outcome" className="input" defaultValue="PASS">
              <option value="PASS">PASS</option>
              <option value="HOLD">HOLD</option>
              <option value="FAIL">FAIL</option>
              <option value="WAIVE">WAIVE (Admin only)</option>
            </select>
          </label>
          <label className="form-row">
            Notes
            <input name="reviewNotes" className="input" placeholder="Outcome notes or follow-up steps..." />
          </label>
        </div>
        <button type="submit" className="button small">
          {action.label}
        </button>
      </form>
    </details>
  );
}

export default function InterviewTaskCard({ task }: InterviewTaskCardProps) {
  const isAccent = task.stage === "NEEDS_ACTION";
  const helper = timestampHelper(task);
  const hasInlineForm = INLINE_FORM_KINDS.has(task.primaryAction.kind);
  const formId = `iv-task-${task.id}-form`;

  return (
    <article
      className={`iv-card iv-task-card${isAccent ? " iv-card-accent" : ""}`}
      aria-labelledby={`${formId}-title`}
    >
      <div className="iv-task-card-row">
        <div className="iv-task-card-identity">
          <div className="iv-task-card-meta">
            <span className="iv-task-card-domain">{domainLabel(task.domain)}</span>
            <StatusBadge tone={stageTone(task.stage)}>{stageLabel(task.stage)}</StatusBadge>
          </div>
          <h4 id={`${formId}-title`} className="iv-task-card-title">
            {task.title}
          </h4>
          <p className="iv-task-card-subtitle">{task.subtitle}</p>
          {helper ? <p className="iv-task-card-helper">{helper}</p> : null}
        </div>
        {!hasInlineForm ? (
          <div className="iv-task-card-action">{renderPrimaryAction(task, formId)}</div>
        ) : null}
      </div>

      {task.detail ? <p className="iv-task-card-detail">{task.detail}</p> : null}

      {hasInlineForm ? (
        <div className="iv-task-card-action-block">{renderPrimaryAction(task, formId)}</div>
      ) : null}

      {(task.blockers.length > 0 || task.secondaryLinks.length > 0) && (
        <div className="iv-task-card-footer">
          {task.blockers.length > 0 ? (
            <div className="iv-task-card-blockers" role="note">
              <span className="iv-task-card-blockers-label">Blocked</span>
              <ul>
                {task.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {task.secondaryLinks.length > 0 ? (
            <div className="iv-task-card-links">
              {task.secondaryLinks.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="button small outline"
                  style={{ textDecoration: "none" }}
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
