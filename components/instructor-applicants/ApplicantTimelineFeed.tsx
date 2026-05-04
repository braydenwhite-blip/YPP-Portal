import type { ReactNode } from "react";

type TimelineEvent = {
  id: string;
  kind: string;
  createdAt: Date | string;
  payload: Record<string, unknown>;
  actor?: { id: string; name: string | null } | null;
};

interface ApplicantTimelineFeedProps {
  events: TimelineEvent[];
}

type Tone = "urgent" | "warning" | "info" | "accent";

function eventTone(kind: string): Tone {
  switch (kind) {
    case "CHAIR_DECISION":
      return "urgent";
    case "REVIEWER_ASSIGNED":
    case "INTERVIEWER_ASSIGNED":
    case "INTERVIEWER_REMOVED":
    case "INTERVIEW_COMPLETED":
    case "CHAIR_REVIEW_QUEUED":
      return "accent";
    case "STATUS_CHANGE":
    case "DOC_UPLOADED":
    case "DOC_REMOVED":
    case "SLOT_POSTED":
    case "SLOT_CONFIRMED":
    case "SCORES_UPDATED":
      return "info";
    case "INFO_REQUESTED":
    case "INFO_RESPONSE_RECEIVED":
    case "NOTE_ADDED":
    case "NOTIFICATION_FAILED":
      return "warning";
    case "NOTIFICATION_RESENT":
      return "info";
    default:
      return "info";
  }
}

function eventLabel(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case "STATUS_CHANGE":
      return `Status changed${payload.from ? ` from ${String(payload.from).replace(/_/g, " ")}` : ""} to ${String(payload.to ?? "").replace(/_/g, " ")}`;
    case "REVIEWER_ASSIGNED": {
      const prev = payload.previousReviewerId;
      return prev ? "Reviewer reassigned" : "Reviewer assigned";
    }
    case "INTERVIEWER_ASSIGNED":
      return `Interviewer assigned${payload.role ? ` (${String(payload.role)})` : ""}`;
    case "INTERVIEWER_REMOVED":
      return `Removed ${payload.role ? String(payload.role).toLowerCase() : ""} interviewer${payload.round != null ? ` (round ${String(payload.round)})` : ""}`.trim();
    case "SCORES_UPDATED": {
      const changed = payload.changed as Record<string, unknown> | undefined;
      const fields = changed ? Object.keys(changed) : [];
      return fields.length > 0
        ? `Updated scores: ${fields.map((f) => f.replace(/^score/, "")).join(", ")}`
        : "Updated scores";
    }
    case "INFO_REQUESTED":
      return "Requested more information";
    case "INFO_RESPONSE_RECEIVED":
      return "Applicant responded to info request";
    case "DOC_UPLOADED":
      return `Document uploaded${payload.kind ? ` - ${String(payload.kind).replace(/_/g, " ")}` : ""}`;
    case "DOC_REMOVED":
      return `Document removed${payload.kind ? ` - ${String(payload.kind).replace(/_/g, " ")}` : ""}`;
    case "SLOT_POSTED":
      return "Interview slot posted";
    case "SLOT_CONFIRMED":
      return "Interview slot confirmed";
    case "INTERVIEW_COMPLETED":
      return "Interview marked complete";
    case "CHAIR_REVIEW_QUEUED":
      return `Queued for chair review${payload.emailed ? " (email sent)" : ""}`;
    case "CHAIR_DECISION":
      return `Chair decision: ${String(payload.action ?? "").replace(/_/g, " ")}`;
    case "NOTE_ADDED":
      return "Note added";
    case "NOTIFICATION_FAILED":
      return `Notification delivery failed${payload.emailKind ? ` (${String(payload.emailKind).replace(/_/g, " ")})` : ""}`;
    case "NOTIFICATION_RESENT":
      return `Notification resent${payload.emailKind ? ` (${String(payload.emailKind).replace(/_/g, " ")})` : ""}`;
    case "TRACK_SELECTED":
      return `Application track selected${payload.applicationTrack ? `: ${String(payload.applicationTrack).replace(/_/g, " ").toLowerCase()}` : ""}`;
    case "WORKSHOP_OUTLINE_SUBMITTED":
      return "Workshop outline submitted";
    case "WORKSHOP_OUTLINE_UPDATED":
      return "Workshop outline updated";
    case "PROMOTION_FLAGGED":
      return "Flagged for promotion to full Instructor";
    case "PROMOTED_TO_STANDARD":
      return "Promoted to full Instructor";
    case "DEMOTED_TO_SUMMER_WORKSHOP":
      return "Subtype changed to Summer Workshop";
    case "SUBTYPE_CHANGED":
      return `Subtype changed${payload.from && payload.to ? ` (${String(payload.from)} → ${String(payload.to)})` : ""}`;
    default:
      return kind.replace(/_/g, " ");
  }
}

function groupByDay(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const day = new Date(event.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[day]) groups[day] = [];
    groups[day].push(event);
  }
  return Object.entries(groups);
}

const TONE_COLOR: Record<Tone, string> = {
  urgent: "var(--dash-stripe-urgent, #ef4444)",
  accent: "var(--dash-stripe-accent, #7c3aed)",
  info: "var(--dash-stripe-info, #3b82f6)",
  warning: "var(--dash-stripe-warning, #f59e0b)",
};

export default function ApplicantTimelineFeed({ events }: ApplicantTimelineFeedProps): ReactNode {
  if (events.length === 0) {
    return (
      <p aria-label="No timeline events yet" className="cockpit-muted">
        No timeline events yet.
      </p>
    );
  }

  const grouped = groupByDay([...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));

  return (
    <div
      role="log"
      aria-label="Application timeline"
      aria-live="polite"
      className="cockpit-timeline"
    >
      {grouped.map(([day, dayEvents]) => (
        <div key={day} className="cockpit-timeline-day">
          <div className="cockpit-timeline-date">
            {day}
          </div>
          <div className="cockpit-timeline-events">
            {dayEvents.map((event) => {
              const tone = eventTone(event.kind);
              return (
                <div
                  key={event.id}
                  className="cockpit-timeline-event"
                >
                  <div
                    className={`dashboard-action-stripe tone-${tone}`}
                  />
                  <div className="cockpit-timeline-content">
                    <div className="cockpit-timeline-label">
                      {eventLabel(event.kind, event.payload)}
                    </div>
                    {event.actor && (
                      <div className="cockpit-timeline-actor">
                        by {event.actor.name ?? "Unknown"}
                      </div>
                    )}
                  </div>
                  <div
                    className="cockpit-timeline-time"
                    title={new Date(event.createdAt).toLocaleString()}
                  >
                    {new Date(event.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
