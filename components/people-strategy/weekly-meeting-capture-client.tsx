"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  addDecision,
  addFollowUp,
  createMeeting,
  saveMeetingNotes,
} from "@/lib/people-strategy/meetings-actions";
import { listInitiativeDefs } from "@/lib/people-strategy/strategic-initiatives";

type PersonOption = { id: string; name: string };

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--ypp-ink)",
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.45,
  padding: "9px 10px",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function WeeklyMeetingCaptureClient({
  people,
  currentUserId,
}: {
  people: PersonOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initiatives = useMemo(() => listInitiativeDefs(), []);
  const defaultOwner = people.some((p) => p.id === currentUserId) ? currentUserId : people[0]?.id ?? "";

  const [title, setTitle] = useState("Weekly Officer Execution Meeting");
  const [date, setDate] = useState(todayISO());
  const [ownerId, setOwnerId] = useState(defaultOwner);
  const [initiativeId, setInitiativeId] = useState("");
  const [attendees, setAttendees] = useState("");
  const [topics, setTopics] = useState("");
  const [decisions, setDecisions] = useState("");
  const [followUps, setFollowUps] = useState("");
  const [actions, setActions] = useState("");
  const [openQuestions, setOpenQuestions] = useState("");
  const [communications, setCommunications] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const initiative = initiatives.find((i) => i.id === initiativeId);
        const topicLines = lines(topics);
        const actionLines = lines(actions);
        const followUpLines = lines(followUps);
        const decisionLines = lines(decisions);
        const communicationLines = lines(communications);
        const questionLines = lines(openQuestions);

        const created = await createMeeting({
          title: title.trim() || "Weekly Officer Execution Meeting",
          purpose: [
            "Run the weekly YPP execution loop.",
            initiative ? `Strategic initiative focus: ${initiative.title}.` : null,
          ]
            .filter(Boolean)
            .join(" "),
          category: initiative?.area ?? "LEADERSHIP",
          priority: "HIGH",
          date,
          startTime: "18:00",
          endTime: "19:00",
          recurrence: "NONE",
          facilitatorId: ownerId || undefined,
          agendaTitles: [...topicLines, ...questionLines].slice(0, 20),
        });

        const noteBody = [
          attendees ? `Attendees\n${attendees}` : null,
          topicLines.length ? `Topics discussed\n${topicLines.map((l) => `- ${l}`).join("\n")}` : null,
          decisionLines.length ? `Decisions made\n${decisionLines.map((l) => `- ${l}`).join("\n")}` : null,
          followUpLines.length ? `Follow-ups\n${followUpLines.map((l) => `- ${l}`).join("\n")}` : null,
          actionLines.length ? `Action items\n${actionLines.map((l) => `- ${l}`).join("\n")}` : null,
          questionLines.length ? `Open questions\n${questionLines.map((l) => `- ${l}`).join("\n")}` : null,
          communicationLines.length ? `Communication needed\n${communicationLines.map((l) => `- ${l}`).join("\n")}` : null,
        ]
          .filter(Boolean)
          .join("\n\n");

        if (noteBody) {
          await saveMeetingNotes({ meetingId: created.id, notes: noteBody });
        }

        for (const decision of decisionLines) {
          await addDecision({
            meetingId: created.id,
            decision,
            decidedById: ownerId || undefined,
          });
        }

        for (const followUp of followUpLines) {
          await addFollowUp({
            meetingId: created.id,
            title: followUp,
            ownerId: ownerId || undefined,
            priority: "MEDIUM",
            area: initiative?.area ?? "LEADERSHIP",
            createAction: false,
          });
        }

        for (const action of actionLines) {
          await addFollowUp({
            meetingId: created.id,
            title: action,
            ownerId: ownerId || undefined,
            priority: "HIGH",
            area: initiative?.area ?? "LEADERSHIP",
            createAction: true,
          });
        }

        router.push(`/meetings/${created.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the meeting workspace.");
      }
    });
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
      {error ? (
        <div role="alert" style={{ padding: 10, borderRadius: 8, background: "var(--danger-bg, #fef2f2)", color: "var(--danger-fg, #991b1b)", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(150px, .6fr)", gap: 12 }}>
        <Field label="Meeting title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12 }}>
        <Field label="Facilitator / default owner">
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} style={fieldStyle}>
            <option value="">Unassigned</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Related initiative">
          <select value={initiativeId} onChange={(e) => setInitiativeId(e.target.value)} style={fieldStyle}>
            <option value="">No initiative focus</option>
            {initiatives.map((initiative) => (
              <option key={initiative.id} value={initiative.id}>
                {initiative.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Attendees">
        <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Brayden, Lily, officers..." style={fieldStyle} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
        <Field label="Topics discussed">
          <textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={4} placeholder="One topic per line" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <Field label="Decisions made">
          <textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={4} placeholder="One decision per line" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <Field label="Follow-ups">
          <textarea value={followUps} onChange={(e) => setFollowUps(e.target.value)} rows={4} placeholder="One follow-up per line" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <Field label="Action items">
          <textarea value={actions} onChange={(e) => setActions(e.target.value)} rows={4} placeholder="These become tracked actions" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <Field label="Open questions">
          <textarea value={openQuestions} onChange={(e) => setOpenQuestions(e.target.value)} rows={3} placeholder="One question per line" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
        <Field label="Communication needed">
          <textarea value={communications} onChange={(e) => setCommunications(e.target.value)} rows={3} placeholder="Who needs to hear what?" style={{ ...fieldStyle, resize: "vertical" }} />
        </Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="button primary small" disabled={pending || !title.trim()} onClick={submit}>
          {pending ? "Creating..." : "Create meeting workspace"}
        </button>
      </div>
    </div>
  );
}
