import Link from "next/link";
import {
  completeApplicationInterviewAndNote,
  confirmInterviewSlot,
  postApplicationInterviewSlotsBulk,
  saveStructuredInterviewNote,
} from "@/lib/application-actions";
import {
  acceptInterviewAvailabilityRequest,
  completeInstructorInterviewAndSetOutcome,
  confirmPostedInterviewSlot,
  postInstructorInterviewSlotsBulk,
  submitInterviewAvailabilityRequest,
} from "@/lib/instructor-interview-actions";
import type { InterviewTask } from "@/lib/interviews/types";

type InterviewTaskCardProps = {
  task: InterviewTask;
};

function withHourOffset(value: string, hours: number) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function stageLabel(stage: InterviewTask["stage"]) {
  if (stage === "NEEDS_ACTION") return "Needs Action";
  if (stage === "SCHEDULED") return "Scheduled";
  if (stage === "COMPLETED") return "Completed";
  return "Blocked";
}

function stagePillClass(stage: InterviewTask["stage"]) {
  if (stage === "NEEDS_ACTION") return "pill-pathway";
  if (stage === "COMPLETED") return "pill-success";
  if (stage === "BLOCKED") return "pill-declined";
  return "";
}

function renderPrimaryAction(task: InterviewTask) {
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
    const second = withHourOffset(action.defaultDateTimeLocal, 2);
    const third = withHourOffset(action.defaultDateTimeLocal, 4);
    return (
      <form action={postApplicationInterviewSlotsBulk} className="form-grid">
        <input type="hidden" name="applicationId" value={action.applicationId} />
        <div className="grid three">
          <label className="form-row">
            Slot 1
            <input type="datetime-local" name="scheduledAt1" className="input" defaultValue={action.defaultDateTimeLocal} required />
          </label>
          <label className="form-row">
            Slot 2
            <input type="datetime-local" name="scheduledAt2" className="input" defaultValue={second} />
          </label>
          <label className="form-row">
            Slot 3
            <input type="datetime-local" name="scheduledAt3" className="input" defaultValue={third} />
          </label>
        </div>
        <div className="grid two">
          <label className="form-row">
            Duration (min)
            <input type="number" className="input" name="duration" defaultValue={30} min={15} max={180} />
          </label>
          <label className="form-row">
            Meeting Link (optional)
            <input type="url" className="input" name="meetingLink" placeholder="https://..." />
          </label>
        </div>
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "complete_hiring_interview_and_note") {
    return (
      <form action={completeApplicationInterviewAndNote} className="form-grid">
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
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "add_hiring_recommendation_note") {
    return (
      <form action={saveStructuredInterviewNote} className="form-grid">
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
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "confirm_readiness_slot") {
    return (
      <form action={confirmPostedInterviewSlot}>
        <input type="hidden" name="slotId" value={action.slotId} />
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "request_readiness_availability") {
    const second = withHourOffset(action.defaultDateTimeLocal, 2);
    const third = withHourOffset(action.defaultDateTimeLocal, 4);
    return (
      <form action={submitInterviewAvailabilityRequest} className="form-grid">
        <input type="hidden" name="instructorId" value={action.instructorId} />
        <div className="grid three">
          <label className="form-row">
            Preferred 1
            <input type="datetime-local" className="input" name="preferredStart1" defaultValue={action.defaultDateTimeLocal} required />
          </label>
          <label className="form-row">
            Preferred 2
            <input type="datetime-local" className="input" name="preferredStart2" defaultValue={second} />
          </label>
          <label className="form-row">
            Preferred 3
            <input type="datetime-local" className="input" name="preferredStart3" defaultValue={third} />
          </label>
        </div>
        <label className="form-row">
          Notes (optional)
          <textarea name="note" className="input" rows={2} placeholder="Timezone, constraints, interviewer preferences..." />
        </label>
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "post_readiness_slots_bulk") {
    const second = withHourOffset(action.defaultDateTimeLocal, 2);
    const third = withHourOffset(action.defaultDateTimeLocal, 4);
    return (
      <form action={postInstructorInterviewSlotsBulk} className="form-grid">
        <input type="hidden" name="instructorId" value={action.instructorId} />
        <input type="hidden" name="gateId" value={action.gateId} />
        <div className="grid three">
          <label className="form-row">
            Slot 1
            <input type="datetime-local" className="input" name="scheduledAt1" defaultValue={action.defaultDateTimeLocal} required />
          </label>
          <label className="form-row">
            Slot 2
            <input type="datetime-local" className="input" name="scheduledAt2" defaultValue={second} />
          </label>
          <label className="form-row">
            Slot 3
            <input type="datetime-local" className="input" name="scheduledAt3" defaultValue={third} />
          </label>
        </div>
        <div className="grid two">
          <label className="form-row">
            Duration (min)
            <input type="number" className="input" name="duration" defaultValue={30} min={15} max={180} />
          </label>
          <label className="form-row">
            Meeting Link (optional)
            <input className="input" type="url" name="meetingLink" placeholder="https://..." />
          </label>
        </div>
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  if (action.kind === "accept_readiness_request") {
    return (
      <form action={acceptInterviewAvailabilityRequest} className="form-grid">
        <input type="hidden" name="requestId" value={action.requestId} />
        <div className="grid two">
          <label className="form-row">
            Scheduled At
            <input type="datetime-local" className="input" name="scheduledAt" defaultValue={action.defaultDateTimeLocal} required />
          </label>
          <label className="form-row">
            Duration (min)
            <input type="number" className="input" name="duration" defaultValue={30} min={15} max={180} />
          </label>
        </div>
        <label className="form-row">
          Meeting Link (optional)
          <input type="url" className="input" name="meetingLink" placeholder="https://..." />
        </label>
        <button type="submit" className="button small">{action.label}</button>
      </form>
    );
  }

  return (
    <form action={completeInstructorInterviewAndSetOutcome} className="form-grid">
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
      <button type="submit" className="button small">{action.label}</button>
    </form>
  );
}

export default function InterviewTaskCard({ task }: InterviewTaskCardProps) {
  return (
    <div
      className="card"
      style={{
        border: task.stage === "NEEDS_ACTION" ? "1px solid #c4b5fd" : "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, marginBottom: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>{task.title}</h4>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{task.subtitle}</p>
        </div>
        <span className={`pill ${stagePillClass(task.stage)}`}>{stageLabel(task.stage)}</span>
      </div>

      <p style={{ marginTop: 0, marginBottom: 10, fontSize: 14 }}>{task.detail}</p>

      {renderPrimaryAction(task)}

      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>More</summary>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {task.blockers.length > 0 ? (
            <div style={{ border: "1px solid #fca5a5", background: "#fef2f2", borderRadius: 8, padding: 8 }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#991b1b" }}>Blockers</p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {task.blockers.map((blocker) => (
                  <li key={blocker} style={{ fontSize: 12, color: "#7f1d1d" }}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {task.secondaryLinks.map((link) => (
              <Link key={link.href + link.label} href={link.href} className="button small outline" style={{ textDecoration: "none" }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
