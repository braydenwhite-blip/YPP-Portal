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
    case "INTERVIEW_COMPLETED":
      return "accent";
    case "STATUS_CHANGE":
    case "DOC_UPLOADED":
    case "DOC_REMOVED":
    case "SLOT_POSTED":
    case "SLOT_CONFIRMED":
      return "info";
    case "NOTE_ADDED":
      return "warning";
    default:
      return "info";
  }
}

function eventLabel(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case "STATUS_CHANGE":
      return `Status changed${payload.from ? ` from ${String(payload.from).replace(/_/g, " ")}` : ""} to ${String(payload.to ?? "").replace(/_/g, " ")}`;
    case "REVIEWER_ASSIGNED":
      return "Reviewer assigned";
    case "INTERVIEWER_ASSIGNED":
      return `Interviewer assigned${payload.role ? ` (${String(payload.role)})` : ""}`;
    case "DOC_UPLOADED":
      return `Document uploaded${payload.kind ? ` — ${String(payload.kind).replace(/_/g, " ")}` : ""}`;
    case "DOC_REMOVED":
      return `Document removed${payload.kind ? ` — ${String(payload.kind).replace(/_/g, " ")}` : ""}`;
    case "SLOT_POSTED":
      return "Interview slot posted";
    case "SLOT_CONFIRMED":
      return "Interview slot confirmed";
    case "INTERVIEW_COMPLETED":
      return "Interview marked complete";
    case "CHAIR_DECISION":
      return `Chair decision: ${String(payload.action ?? "").replace(/_/g, " ")}`;
    case "NOTE_ADDED":
      return "Note added";
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
      <p aria-label="No timeline events yet" style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
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
      style={{ display: "grid", gap: 16 }}
    >
      {grouped.map(([day, dayEvents]) => (
        <div key={day}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: 8,
            }}
          >
            {day}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {dayEvents.map((event) => {
              const tone = eventTone(event.kind);
              return (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "#fff",
                  }}
                >
                  <div
                    className={`dashboard-action-stripe tone-${tone}`}
                    style={{ alignSelf: "stretch", minHeight: 20, borderRadius: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {eventLabel(event.kind, event.payload)}
                    </div>
                    {event.actor && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        by {event.actor.name ?? "Unknown"}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}
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
