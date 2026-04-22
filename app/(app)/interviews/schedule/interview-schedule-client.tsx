"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AddToCalendarButton from "@/components/add-to-calendar-button";
import { sendMessage } from "@/lib/messaging-actions";
import {
  bookInterviewWorkflowSlot,
  cancelInterviewWorkflow,
  confirmInterviewReschedule,
  createInterviewAvailabilityOverride,
  createInterviewAvailabilityRule,
  deactivateInterviewAvailabilityOverride,
  deactivateInterviewAvailabilityRule,
  requestInterviewReschedule,
  type InterviewCalendarSlotView,
  type InterviewCalendarView,
  type InterviewSchedulePageData,
  type InterviewWorkflowView,
} from "@/lib/interview-scheduling-actions";

const STATUS_STYLES: Record<
  InterviewWorkflowView["status"],
  { label: string; background: string; color: string; border: string }
> = {
  UNSCHEDULED: {
    label: "Unscheduled",
    background: "rgba(245, 158, 11, 0.12)",
    color: "#92400e",
    border: "rgba(245, 158, 11, 0.24)",
  },
  AWAITING_RESPONSE: {
    label: "Awaiting Response",
    background: "rgba(59, 130, 246, 0.12)",
    color: "#1d4ed8",
    border: "rgba(59, 130, 246, 0.24)",
  },
  BOOKED: {
    label: "Booked",
    background: "rgba(16, 185, 129, 0.12)",
    color: "#047857",
    border: "rgba(16, 185, 129, 0.24)",
  },
  RESCHEDULE_REQUESTED: {
    label: "Reschedule Requested",
    background: "rgba(244, 114, 182, 0.12)",
    color: "#be185d",
    border: "rgba(244, 114, 182, 0.24)",
  },
  STALE: {
    label: "At Risk",
    background: "rgba(239, 68, 68, 0.12)",
    color: "#b91c1c",
    border: "rgba(239, 68, 68, 0.24)",
  },
  COMPLETED: {
    label: "Completed",
    background: "rgba(15, 118, 110, 0.12)",
    color: "#0f766e",
    border: "rgba(15, 118, 110, 0.24)",
  },
  CANCELLED: {
    label: "Cancelled",
    background: "rgba(100, 116, 139, 0.12)",
    color: "#475569",
    border: "rgba(100, 116, 139, 0.24)",
  },
};

const DOMAIN_STYLES: Record<"HIRING" | "READINESS", { background: string; color: string }> = {
  HIRING: {
    background: "rgba(37, 99, 235, 0.12)",
    color: "#1d4ed8",
  },
  READINESS: {
    background: "rgba(234, 88, 12, 0.12)",
    color: "#c2410c",
  },
};

const SURFACE_CARD: CSSProperties = {
  border: "1px solid rgba(99, 102, 241, 0.07)",
  borderRadius: "var(--radius-xl)",
  background: "var(--surface)",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
};

type FeedbackState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

type Viewer = InterviewSchedulePageData["viewer"];
type WorkflowStatusFilter = "ALL" | InterviewWorkflowView["status"];
type PanelMode = "queue" | "calendars";
type QueueSectionKey = "attention" | "booked" | "closed";

function formatLocalDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCompactDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHourAge(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

function formatDayLabel(dayOfWeek: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek] ?? "Day";
}

function defaultLocalDateTime(offsetHours = 24) {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function scopeLabel(scope: string) {
  if (scope === "ALL") return "All interview types";
  return scope === "HIRING" ? "Hiring only" : "Readiness only";
}

function toneForWorkflow(workflow: InterviewWorkflowView) {
  if (workflow.status === "STALE") return "#ef4444";
  if (workflow.status === "BOOKED") return "#10b981";
  if (workflow.status === "RESCHEDULE_REQUESTED") return "#ec4899";
  if (workflow.status === "AWAITING_RESPONSE") return "#3b82f6";
  return "#f59e0b";
}

function isUpcoming(iso: string | null, days: number) {
  if (!iso) return false;
  const now = Date.now();
  const value = new Date(iso).getTime();
  return value >= now && value <= now + days * 24 * 60 * 60 * 1000;
}

function matchesSearch(workflow: InterviewWorkflowView, search: string) {
  if (!search) return true;
  const haystack = [
    workflow.title,
    workflow.subtitle,
    workflow.chapterName,
    workflow.intervieweeName,
    workflow.interviewerName ?? "",
    workflow.ownerName,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search.toLowerCase());
}

function feedbackColors(type: "success" | "error") {
  return type === "success"
    ? { background: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.24)", color: "#047857" }
    : { background: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.24)", color: "#b91c1c" };
}

function Banner({ feedback, onDismiss }: { feedback: Exclude<FeedbackState, null>; onDismiss: () => void }) {
  const colors = feedbackColors(feedback.type);
  return (
    <div
      style={{
        ...SURFACE_CARD,
        padding: "0.95rem 1rem",
        marginBottom: "1rem",
        background: colors.background,
        borderColor: colors.border,
        color: colors.color,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
      }}
    >
      <strong style={{ fontSize: 14 }}>{feedback.message}</strong>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function SummaryTile({
  eyebrow,
  value,
  label,
  accent,
}: {
  eyebrow: string;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-md)",
        padding: "1rem 1.1rem",
        background: "var(--surface)",
        border: `1px solid ${accent}22`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function FocusButton({
  label,
  detail,
  count,
  active,
  accent,
  onClick,
}: {
  label: string;
  detail: string;
  count: number;
  active?: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 84,
        borderRadius: "var(--radius-md)",
        border: active ? `1px solid ${accent}` : "1px solid rgba(148,163,184,0.18)",
        background: active ? `${accent}14` : "rgba(255,255,255,0.86)",
        color: "var(--text)",
        cursor: "pointer",
        padding: "0.9rem 1rem",
        textAlign: "left",
        display: "grid",
        gap: 5,
        boxShadow: active ? `0 14px 32px ${accent}1f` : "inset 0 1px 0 rgba(255,255,255,0.75)",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>
          {label}
        </span>
        <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{count}</span>
      </span>
      <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>{detail}</span>
    </button>
  );
}

function Pill({
  label,
  background,
  color,
  border,
}: {
  label: string;
  background: string;
  color: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "0.35rem 0.7rem",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        background,
        color,
        border: `1px solid ${border ?? "transparent"}`,
      }}
    >
      {label}
    </span>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        ...SURFACE_CARD,
        padding: "1.2rem",
        borderStyle: "dashed",
        boxShadow: "none",
        color: "var(--muted)",
      }}
    >
      <div style={{ fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function WorkflowMiniCard({
  workflow,
  isSelected,
  onSelect,
}: {
  workflow: InterviewWorkflowView;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusStyle = STATUS_STYLES[workflow.status];
  const domainStyle = DOMAIN_STYLES[workflow.domain];
  const accent = toneForWorkflow(workflow);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        minHeight: 132,
        textAlign: "left",
        borderRadius: "var(--radius-md)",
        border: isSelected ? `1px solid ${accent}80` : "1px solid rgba(148,163,184,0.16)",
        background: isSelected
          ? `linear-gradient(180deg, ${accent}12 0%, rgba(255,255,255,0.98) 70%)`
          : "rgba(255,255,255,0.92)",
        boxShadow: isSelected ? `0 14px 34px ${accent}1a` : "none",
        padding: "0.95rem",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 5,
          background: accent,
          opacity: isSelected ? 0.95 : 0.45,
        }}
      />
      <span style={{ display: "grid", gap: 9, paddingLeft: 6 }}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>
              {workflow.title}
            </span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {workflow.intervieweeName} · {workflow.chapterName}
            </span>
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: accent, flexShrink: 0 }}>
            {formatHourAge(workflow.ageHours)}
          </span>
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Pill label={workflow.domain === "HIRING" ? "Hiring" : "Readiness"} background={domainStyle.background} color={domainStyle.color} />
          <Pill label={statusStyle.label} background={statusStyle.background} color={statusStyle.color} border={statusStyle.border} />
        </span>
        <span style={{ display: "grid", gap: 3, fontSize: 12, color: "var(--muted)" }}>
          <span>
            {workflow.scheduledAt ? formatCompactDateTime(workflow.scheduledAt) : `${workflow.openSlots.length} open slot${workflow.openSlots.length === 1 ? "" : "s"}`}
          </span>
          <span>
            {workflow.interviewerName ? `With ${workflow.interviewerName}` : workflow.statusLabel}
          </span>
        </span>
      </span>
    </button>
  );
}

function QueueSection({
  title,
  subtitle,
  workflows,
  selectedWorkflowId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  workflows: InterviewWorkflowView[];
  selectedWorkflowId: string | null;
  onSelect: (workflowId: string) => void;
}) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--muted)" }}>{workflows.length}</div>
      </div>

      {workflows.length === 0 ? (
        <EmptyPanel title="Nothing here" body="This lane is clear for the current filters." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {workflows.map((workflow) => (
            <WorkflowMiniCard
              key={workflow.id}
              workflow={workflow}
              isSelected={workflow.id === selectedWorkflowId}
              onSelect={() => onSelect(workflow.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SlotButton({
  slot,
  isPending,
  onSelect,
}: {
  slot: InterviewCalendarSlotView;
  isPending: boolean;
  onSelect: (slot: InterviewCalendarSlotView) => void;
}) {
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => onSelect(slot)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "0.9rem",
        borderRadius: 18,
        border: "1px solid rgba(59, 130, 246, 0.18)",
        background: "linear-gradient(180deg, rgba(239,246,255,0.92) 0%, rgba(255,255,255,0.98) 100%)",
        cursor: isPending ? "wait" : "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{formatCompactDateTime(slot.startsAt)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {slot.duration} min with {slot.interviewerName}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>{slot.interviewerRole}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{slot.timezone}</div>
        </div>
      </div>
      {slot.locationLabel || slot.meetingLink ? (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          {slot.locationLabel ?? "Video meeting"}
        </div>
      ) : null}
      {slot.warningLabels.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {slot.warningLabels.slice(0, 2).map((warning) => (
            <Pill
              key={warning}
              label={warning}
              background="rgba(245, 158, 11, 0.12)"
              color="#92400e"
              border="rgba(245, 158, 11, 0.2)"
            />
          ))}
        </div>
      ) : null}
    </button>
  );
}

function QuickMessageComposer({
  conversationId,
  workflowId,
  isPending,
  onSend,
}: {
  conversationId: string;
  workflowId: string;
  isPending: boolean;
  onSend: (conversationId: string, content: string, actionId: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div
      style={{
        borderRadius: 18,
        padding: "0.95rem",
        border: "1px solid rgba(148, 163, 184, 0.18)",
        background: "rgba(248,250,252,0.88)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Interview thread</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Use the shared thread for logistics, prep notes, and reschedule questions.
          </div>
        </div>
        <Link href={`/messages/${conversationId}`} className="button small outline" style={{ textDecoration: "none", flexShrink: 0 }}>
          Open thread
        </Link>
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        className="input"
        placeholder="Send a quick note to the interviewer, interviewee, and chapter operators..."
        style={{ width: "100%", marginTop: 12, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12 }}>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Everyone in the interview thread stays on the same timeline.
        </div>
        <button
          type="button"
          className="button small"
          disabled={isPending || !draft.trim()}
          onClick={() => {
            onSend(conversationId, draft, `message:${workflowId}`);
            setDraft("");
          }}
        >
          Send update
        </button>
      </div>
    </div>
  );
}

function WorkflowCard({
  viewer,
  workflow,
  isPending,
  activeActionId,
  onBook,
  onConfirmReschedule,
  onRequestReschedule,
  onCancel,
  onSendMessage,
}: {
  viewer: Viewer;
  workflow: InterviewWorkflowView;
  isPending: boolean;
  activeActionId: string | null;
  onBook: (workflow: InterviewWorkflowView, slot: InterviewCalendarSlotView, note: string) => void;
  onConfirmReschedule: (workflow: InterviewWorkflowView, slot: InterviewCalendarSlotView, note: string) => void;
  onRequestReschedule: (requestId: string, note: string) => void;
  onCancel: (requestId: string, note: string) => void;
  onSendMessage: (conversationId: string, content: string, actionId: string) => void;
}) {
  const statusStyle = STATUS_STYLES[workflow.status];
  const domainStyle = DOMAIN_STYLES[workflow.domain];
  const canBookFromOpenSlots =
    workflow.openSlots.length > 0 &&
    (workflow.status === "RESCHEDULE_REQUESTED"
      ? viewer.isReviewer
      : viewer.isReviewer || viewer.userId === workflow.intervieweeId);
  const canRequestReschedule =
    !!workflow.activeRequestId &&
    (viewer.isReviewer ||
      viewer.userId === workflow.intervieweeId ||
      viewer.userId === workflow.interviewerId);
  const canConfirmReschedule =
    viewer.isReviewer &&
    workflow.status === "RESCHEDULE_REQUESTED" &&
    !!workflow.activeRequestId &&
    workflow.openSlots.length > 0;
  const canCancel =
    !!workflow.activeRequestId &&
    (viewer.isReviewer ||
      viewer.userId === workflow.intervieweeId ||
      viewer.userId === workflow.interviewerId);
  const bookingActionId = `book:${workflow.id}`;
  const rescheduleActionId = `reschedule:${workflow.id}`;
  const cancelActionId = `cancel:${workflow.id}`;
  const [bookingNote, setBookingNote] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("I need a new interview time.");
  const [cancelNote, setCancelNote] = useState("Cancelling this interview booking.");

  return (
    <div
      style={{
        ...SURFACE_CARD,
        padding: "1.2rem",
        borderColor: `${toneForWorkflow(workflow)}22`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 auto auto 0",
          width: 6,
          height: "100%",
          background: toneForWorkflow(workflow),
          opacity: 0.9,
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", paddingLeft: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <Pill
              label={workflow.domain === "HIRING" ? "Hiring" : "Readiness"}
              background={domainStyle.background}
              color={domainStyle.color}
            />
            <Pill
              label={statusStyle.label}
              background={statusStyle.background}
              color={statusStyle.color}
              border={statusStyle.border}
            />
            {workflow.isAtRisk ? (
              <Pill
                label="24h SLA active"
                background="rgba(239, 68, 68, 0.12)"
                color="#b91c1c"
                border="rgba(239, 68, 68, 0.2)"
              />
            ) : null}
          </div>

          <h3 style={{ margin: 0, fontSize: 22, lineHeight: 1.15 }}>{workflow.title}</h3>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
            {workflow.subtitle} in {workflow.chapterName}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Aging
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 2 }}>{formatHourAge(workflow.ageHours)}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginTop: 18,
          paddingLeft: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Interviewee
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{workflow.intervieweeName}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{workflow.intervieweeEmail}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Interviewer
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{workflow.interviewerName ?? "Pick from calendar"}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{workflow.interviewerRole ?? workflow.ownerName}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Scheduled time
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>
            {workflow.scheduledAt ? formatLocalDateTime(workflow.scheduledAt) : "Waiting for booking"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {workflow.sourceTimezone ? `Source timezone: ${workflow.sourceTimezone}` : "Viewer-local time shown"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Next action
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{workflow.statusLabel}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{workflow.ownerName}</div>
        </div>
      </div>

      {workflow.scheduledAt && workflow.duration ? (
        <div
          style={{
            marginTop: 18,
            marginLeft: 8,
            padding: "0.95rem 1rem",
            borderRadius: 18,
            background: "linear-gradient(180deg, rgba(240,253,250,0.95) 0%, rgba(255,255,255,0.98) 100%)",
            border: "1px solid rgba(16, 185, 129, 0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                {formatLocalDateTime(workflow.scheduledAt)}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {workflow.duration} min
                {workflow.meetingLink ? " · Video link ready" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {workflow.meetingLink ? (
                <a
                  href={workflow.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="button small"
                  style={{ textDecoration: "none" }}
                >
                  Join meeting
                </a>
              ) : null}
              <AddToCalendarButton
                scheduledAt={new Date(workflow.scheduledAt)}
                duration={workflow.duration}
                positionTitle={workflow.title}
                applicantName={workflow.intervieweeName}
                meetingLink={workflow.meetingLink}
              />
            </div>
          </div>
        </div>
      ) : null}

      {workflow.warnings.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, marginLeft: 8 }}>
          {workflow.warnings.map((warning) => (
            <Pill
              key={warning}
              label={warning}
              background="rgba(245, 158, 11, 0.12)"
              color="#92400e"
              border="rgba(245, 158, 11, 0.2)"
            />
          ))}
        </div>
      ) : null}

      {workflow.note ? (
        <div
          style={{
            marginTop: 16,
            marginLeft: 8,
            padding: "0.9rem",
            borderRadius: 18,
            background: "rgba(248,250,252,0.9)",
            border: "1px solid rgba(148, 163, 184, 0.16)",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          {workflow.note}
        </div>
      ) : null}

      {canBookFromOpenSlots ? (
        <div style={{ marginTop: 18, marginLeft: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {workflow.status === "RESCHEDULE_REQUESTED" ? "Pick the replacement time" : "Pick a live calendar slot"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>
            Viewer-local times are shown first, with the interviewer&apos;s source timezone attached to every slot.
          </div>

          <textarea
            value={workflow.status === "RESCHEDULE_REQUESTED" ? rescheduleNote : bookingNote}
            onChange={(event) =>
              workflow.status === "RESCHEDULE_REQUESTED"
                ? setRescheduleNote(event.target.value)
                : setBookingNote(event.target.value)
            }
            rows={2}
            className="input"
            placeholder={
              workflow.status === "RESCHEDULE_REQUESTED"
                ? "Add context for the replacement booking..."
                : "Optional note for the interview thread..."
            }
            style={{ width: "100%", boxSizing: "border-box", marginTop: 12 }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 12,
            }}
          >
            {workflow.openSlots.slice(0, 8).map((slot) => (
              <SlotButton
                key={slot.slotKey}
                slot={slot}
                isPending={isPending && activeActionId === (workflow.status === "RESCHEDULE_REQUESTED" ? rescheduleActionId : bookingActionId)}
                onSelect={(selectedSlot) => {
                  if (workflow.status === "RESCHEDULE_REQUESTED" && canConfirmReschedule) {
                    onConfirmReschedule(workflow, selectedSlot, rescheduleNote);
                    return;
                  }

                  onBook(workflow, selectedSlot, bookingNote);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {(canRequestReschedule || canCancel) && workflow.activeRequestId ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 12,
            marginTop: 18,
            marginLeft: 8,
          }}
        >
          {canRequestReschedule ? (
            <div
              style={{
                padding: "1rem",
                borderRadius: 18,
                background: "rgba(253,242,248,0.85)",
                border: "1px solid rgba(244, 114, 182, 0.18)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>Need a different time?</div>
              <textarea
                value={rescheduleNote}
                onChange={(event) => setRescheduleNote(event.target.value)}
                rows={3}
                className="input"
                style={{ width: "100%", boxSizing: "border-box", marginTop: 10 }}
                placeholder="Tell the thread what changed, what times no longer work, or any cutoff to respect."
              />
              <button
                type="button"
                className="button small"
                disabled={isPending && activeActionId === rescheduleActionId}
                style={{ marginTop: 10 }}
                onClick={() => onRequestReschedule(workflow.activeRequestId!, rescheduleNote)}
              >
                Request reschedule
              </button>
            </div>
          ) : null}

          {canCancel ? (
            <div
              style={{
                padding: "1rem",
                borderRadius: 18,
                background: "rgba(248,250,252,0.92)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>Cancel this booking</div>
              <textarea
                value={cancelNote}
                onChange={(event) => setCancelNote(event.target.value)}
                rows={3}
                className="input"
                style={{ width: "100%", boxSizing: "border-box", marginTop: 10 }}
                placeholder="Explain why the booking is being cancelled and what should happen next."
              />
              <button
                type="button"
                className="button small outline"
                disabled={isPending && activeActionId === cancelActionId}
                style={{ marginTop: 10, color: "#b91c1c", borderColor: "rgba(239, 68, 68, 0.24)" }}
                onClick={() => onCancel(workflow.activeRequestId!, cancelNote)}
              >
                Cancel interview
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {workflow.conversationId ? (
        <div style={{ marginTop: 18, marginLeft: 8 }}>
          <QuickMessageComposer
            conversationId={workflow.conversationId}
            workflowId={workflow.id}
            isPending={isPending && activeActionId === `message:${workflow.id}`}
            onSend={onSendMessage}
          />
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, marginLeft: 8 }}>
        <Link href={workflow.detailHref} className="button small outline" style={{ textDecoration: "none" }}>
          {workflow.domain === "HIRING" ? "Open workspace" : "Open record"}
        </Link>
        {workflow.conversationId ? (
          <Link href={`/messages/${workflow.conversationId}`} className="button small outline" style={{ textDecoration: "none" }}>
            Open interview thread
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function CalendarCard({
  calendar,
  isSelected,
  onSelect,
}: {
  calendar: InterviewCalendarView;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 20,
        padding: "1rem",
        cursor: "pointer",
        border: isSelected ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(148,163,184,0.16)",
        background: isSelected
          ? "linear-gradient(180deg, rgba(239,246,255,0.96) 0%, rgba(255,255,255,0.98) 100%)"
          : "rgba(255,255,255,0.94)",
        boxShadow: isSelected ? "0 16px 36px rgba(37, 99, 235, 0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{calendar.interviewerName}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {calendar.interviewerRole}
            {calendar.chapterName ? ` · ${calendar.chapterName}` : ""}
          </div>
        </div>
        <Pill
          label={`${calendar.nextOpenSlots.length} open`}
          background="rgba(16, 185, 129, 0.12)"
          color="#047857"
          border="rgba(16, 185, 129, 0.2)"
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Pill
          label={`${calendar.rules.length} weekly rule${calendar.rules.length === 1 ? "" : "s"}`}
          background="rgba(59, 130, 246, 0.12)"
          color="#1d4ed8"
          border="rgba(59, 130, 246, 0.2)"
        />
        <Pill
          label={`${calendar.overrides.length} override${calendar.overrides.length === 1 ? "" : "s"}`}
          background="rgba(244, 114, 182, 0.12)"
          color="#be185d"
          border="rgba(244, 114, 182, 0.2)"
        />
      </div>
      {calendar.nextOpenSlots[0] ? (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          Next slot: {formatCompactDateTime(calendar.nextOpenSlots[0].startsAt)}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          No live slots generated yet
        </div>
      )}
    </button>
  );
}

function CalendarManager({
  viewer,
  calendars,
  selectedInterviewerId,
  onSelectInterviewer,
  isPending,
  activeActionId,
  onCreateRule,
  onRemoveRule,
  onCreateOverride,
  onRemoveOverride,
}: {
  viewer: Viewer;
  calendars: InterviewCalendarView[];
  selectedInterviewerId: string | null;
  onSelectInterviewer: (id: string) => void;
  isPending: boolean;
  activeActionId: string | null;
  onCreateRule: (formData: FormData) => void;
  onRemoveRule: (ruleId: string, actionId: string) => void;
  onCreateOverride: (formData: FormData) => void;
  onRemoveOverride: (overrideId: string, actionId: string) => void;
}) {
  const selectedCalendar =
    calendars.find((calendar) => calendar.interviewerId === selectedInterviewerId) ?? calendars[0] ?? null;

  if (!selectedCalendar) {
    return (
      <div style={{ ...SURFACE_CARD, padding: "1.2rem" }}>
        <div style={{ fontWeight: 700 }}>No interviewer calendars yet</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
          Add your first interviewer calendar to start generating bookable interview times.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {calendars.map((calendar) => (
          <CalendarCard
            key={calendar.interviewerId}
            calendar={calendar}
            isSelected={calendar.interviewerId === selectedCalendar.interviewerId}
            onSelect={() => onSelectInterviewer(calendar.interviewerId)}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ ...SURFACE_CARD, padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Interviewer calendar
              </div>
              <h3 style={{ margin: "6px 0 0", fontSize: 24 }}>{selectedCalendar.interviewerName}</h3>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                {selectedCalendar.interviewerRole}
                {selectedCalendar.chapterName ? ` · ${selectedCalendar.chapterName}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill
                label={`${selectedCalendar.rules.length} weekly rules`}
                background="rgba(59, 130, 246, 0.12)"
                color="#1d4ed8"
              />
              <Pill
                label={`${selectedCalendar.nextOpenSlots.length} next slots`}
                background="rgba(16, 185, 129, 0.12)"
                color="#047857"
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
              marginTop: 18,
            }}
          >
            {selectedCalendar.nextOpenSlots.slice(0, 6).map((slot) => (
              <div
                key={slot.slotKey}
                style={{
                  borderRadius: 18,
                  padding: "0.9rem",
                  border: "1px solid rgba(16, 185, 129, 0.16)",
                  background: "rgba(240,253,250,0.85)",
                }}
              >
                <div style={{ fontWeight: 700 }}>{formatCompactDateTime(slot.startsAt)}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {slot.duration} min · {scopeLabel("ALL")}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{slot.timezone}</div>
              </div>
            ))}
            {selectedCalendar.nextOpenSlots.length === 0 ? (
              <div
                style={{
                  borderRadius: 18,
                  padding: "1rem",
                  border: "1px dashed rgba(148,163,184,0.28)",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                No open slots are generating yet. Add a weekly rule or one-off opening below.
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ ...SURFACE_CARD, padding: "1.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Weekly availability rules</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            These rules power the shared hiring and readiness booking surface.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {selectedCalendar.rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  borderRadius: 18,
                  padding: "0.95rem",
                  border: "1px solid rgba(59, 130, 246, 0.16)",
                  background: "rgba(239,246,255,0.88)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {formatDayLabel(rule.dayOfWeek)} · {rule.startTime} to {rule.endTime}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {scopeLabel(rule.scope)} · {rule.slotDuration} min · {rule.bufferMinutes} min buffer · {rule.timezone}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {rule.locationLabel ?? rule.meetingLink ?? "No default location set"}
                  </div>
                </div>
                {viewer.isReviewer ? (
                  <button
                    type="button"
                    className="button small outline"
                    disabled={isPending && activeActionId === `rule-remove:${rule.id}`}
                    onClick={() => onRemoveRule(rule.id, `rule-remove:${rule.id}`)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {selectedCalendar.rules.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No weekly rules yet.</div>
            ) : null}
          </div>

          {viewer.isReviewer ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onCreateRule(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid rgba(148,163,184,0.14)",
                display: "grid",
                gap: 12,
              }}
            >
              <input type="hidden" name="interviewerId" value={selectedCalendar.interviewerId} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Day
                  <select name="dayOfWeek" className="input" defaultValue="1">
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </label>
                <label className="form-row">
                  Start
                  <input type="time" name="startTime" className="input" defaultValue="15:00" required />
                </label>
                <label className="form-row">
                  End
                  <input type="time" name="endTime" className="input" defaultValue="18:00" required />
                </label>
                <label className="form-row">
                  Scope
                  <select name="scope" className="input" defaultValue="ALL">
                    <option value="ALL">Hiring + Readiness</option>
                    <option value="HIRING">Hiring only</option>
                    <option value="READINESS">Readiness only</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Slot duration
                  <input type="number" name="slotDuration" className="input" min={15} max={180} defaultValue={30} />
                </label>
                <label className="form-row">
                  Buffer
                  <input type="number" name="bufferMinutes" className="input" min={0} max={60} defaultValue={10} />
                </label>
                <label className="form-row">
                  Timezone
                  <input type="text" name="timezone" className="input" defaultValue="America/New_York" />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Default meeting link
                  <input type="url" name="meetingLink" className="input" placeholder="https://meet.google.com/..." />
                </label>
                <label className="form-row">
                  Location label
                  <input type="text" name="locationLabel" className="input" placeholder="Zoom room or in-person space" />
                </label>
              </div>

              <button
                type="submit"
                className="button"
                disabled={isPending && activeActionId === `rule-create:${selectedCalendar.interviewerId}`}
                onClick={() => void 0}
              >
                Add weekly rule
              </button>
            </form>
          ) : null}
        </div>

        <div style={{ ...SURFACE_CARD, padding: "1.25rem" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Overrides and blackout windows</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
            Use open overrides for one-off interview blocks, or blocked overrides for vacations and blackout periods.
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            {selectedCalendar.overrides.map((override) => (
              <div
                key={override.id}
                style={{
                  borderRadius: 18,
                  padding: "0.95rem",
                  border: "1px solid rgba(244, 114, 182, 0.18)",
                  background: override.type === "OPEN" ? "rgba(240,253,250,0.86)" : "rgba(255,241,242,0.9)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {override.type === "OPEN" ? "Open window" : "Blocked window"} · {formatLocalDateTime(override.startsAt)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    Until {formatLocalDateTime(override.endsAt)} · {scopeLabel(override.scope)} · {override.timezone}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {override.note ?? override.locationLabel ?? override.meetingLink ?? "No note attached"}
                  </div>
                </div>
                {viewer.isReviewer ? (
                  <button
                    type="button"
                    className="button small outline"
                    disabled={isPending && activeActionId === `override-remove:${override.id}`}
                    onClick={() => onRemoveOverride(override.id, `override-remove:${override.id}`)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
            {selectedCalendar.overrides.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No overrides yet.</div>
            ) : null}
          </div>

          {viewer.isReviewer ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onCreateOverride(new FormData(event.currentTarget));
                event.currentTarget.reset();
              }}
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px solid rgba(148,163,184,0.14)",
                display: "grid",
                gap: 12,
              }}
            >
              <input type="hidden" name="interviewerId" value={selectedCalendar.interviewerId} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Type
                  <select name="type" className="input" defaultValue="BLOCKED">
                    <option value="BLOCKED">Blocked</option>
                    <option value="OPEN">Open extra time</option>
                  </select>
                </label>
                <label className="form-row">
                  Scope
                  <select name="scope" className="input" defaultValue="ALL">
                    <option value="ALL">Hiring + Readiness</option>
                    <option value="HIRING">Hiring only</option>
                    <option value="READINESS">Readiness only</option>
                  </select>
                </label>
                <label className="form-row">
                  Timezone
                  <input type="text" name="timezone" className="input" defaultValue="America/New_York" />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Starts at
                  <input type="datetime-local" name="startsAt" className="input" defaultValue={defaultLocalDateTime(24)} required />
                </label>
                <label className="form-row">
                  Ends at
                  <input type="datetime-local" name="endsAt" className="input" defaultValue={defaultLocalDateTime(27)} required />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Slot duration
                  <input type="number" name="slotDuration" className="input" min={15} max={180} defaultValue={30} />
                </label>
                <label className="form-row">
                  Buffer
                  <input type="number" name="bufferMinutes" className="input" min={0} max={60} defaultValue={10} />
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <label className="form-row">
                  Meeting link
                  <input type="url" name="meetingLink" className="input" placeholder="https://meet.google.com/..." />
                </label>
                <label className="form-row">
                  Location label
                  <input type="text" name="locationLabel" className="input" placeholder="Optional location name" />
                </label>
              </div>

              <label className="form-row">
                Note
                <textarea
                  name="note"
                  className="input"
                  rows={2}
                  placeholder="Explain the blackout, extra office hours, or special scheduling instructions."
                />
              </label>

              <button
                type="submit"
                className="button"
                disabled={isPending && activeActionId === `override-create:${selectedCalendar.interviewerId}`}
                onClick={() => void 0}
              >
                Add override
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function InterviewScheduleClient({
  data,
}: {
  data: InterviewSchedulePageData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>(
    searchParams.get("panel") === "calendars" ? "calendars" : "queue"
  );
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [domainFilter, setDomainFilter] = useState<"ALL" | "HIRING" | "READINESS">(
    searchParams.get("domain") === "HIRING" || searchParams.get("scope") === "HIRING"
      ? "HIRING"
      : searchParams.get("domain") === "READINESS" || searchParams.get("scope") === "READINESS"
      ? "READINESS"
      : "ALL"
  );
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>(
    (searchParams.get("status") as WorkflowStatusFilter) || "ALL"
  );
  const [chapterFilter, setChapterFilter] = useState(searchParams.get("chapter") ?? "ALL");
  const [interviewerFilter, setInterviewerFilter] = useState(
    searchParams.get("interviewer") ?? "ALL"
  );
  const [selectedInterviewerId, setSelectedInterviewerId] = useState<string | null>(
    searchParams.get("interviewer") ??
      data.calendars[0]?.interviewerId ??
      data.interviewerOptions[0]?.id ??
      null
  );
  const requestedWorkflowId = searchParams.get("workflow");
  const requestedApplicationId = searchParams.get("applicationId");
  const openedFromInstructorApplicantWorkspace =
    searchParams.get("source") === "instructorApplicant";
  const requestedWorkflow = requestedWorkflowId
    ? data.workflows.find(
        (workflow) =>
          workflow.id === requestedWorkflowId ||
          workflow.workflowId === requestedWorkflowId
      ) ?? null
    : null;
  const requestedApplicantWorkflow = requestedApplicationId
    ? data.workflows.find(
        (workflow) =>
          workflow.domain === "HIRING" &&
          workflow.workflowId === requestedApplicationId
      ) ?? null
    : null;
  const hasSchedulerDeepLink = Boolean(requestedWorkflowId || requestedApplicationId);
  const schedulerDeepLinkResolved = Boolean(requestedWorkflow || requestedApplicantWorkflow);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    requestedWorkflow?.id ??
      requestedApplicantWorkflow?.id ??
      (hasSchedulerDeepLink ? null : data.workflows[0]?.id ?? null)
  );
  const deferredSearch = useDeferredValue(search.trim());

  async function runAction(actionId: string, successMessage: string, task: () => Promise<void>) {
    setFeedback(null);
    setActiveActionId(actionId);

    startTransition(async () => {
      try {
        await task();
        setFeedback({ type: "success", message: successMessage });
        router.refresh();
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Something went wrong.",
        });
      } finally {
        setActiveActionId(null);
      }
    });
  }

  const chapterOptions = Array.from(
    new Map(
      data.workflows
        .filter((workflow) => workflow.chapterId)
        .map((workflow) => [workflow.chapterId!, workflow.chapterName])
    )
  ).map(([id, name]) => ({ id, name }));

  const filteredWorkflows = data.workflows.filter((workflow) => {
    if (domainFilter !== "ALL" && workflow.domain !== domainFilter) return false;
    if (statusFilter !== "ALL" && workflow.status !== statusFilter) return false;
    if (chapterFilter !== "ALL" && workflow.chapterId !== chapterFilter) return false;
    if (interviewerFilter !== "ALL" && workflow.interviewerId !== interviewerFilter) return false;
    if (!matchesSearch(workflow, deferredSearch)) return false;
    return true;
  });

  const attentionWorkflows = filteredWorkflows.filter((workflow) =>
    ["UNSCHEDULED", "AWAITING_RESPONSE", "RESCHEDULE_REQUESTED", "STALE"].includes(workflow.status)
  );
  const bookedWorkflows = filteredWorkflows.filter((workflow) => workflow.status === "BOOKED");
  const closedWorkflows = filteredWorkflows.filter((workflow) =>
    ["COMPLETED", "CANCELLED"].includes(workflow.status)
  );
  const queueWorkflows = [...attentionWorkflows, ...bookedWorkflows, ...closedWorkflows];
  const selectedWorkflow =
    queueWorkflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    queueWorkflows[0] ??
    null;
  const openedFromApplicantWorkspace = Boolean(
    requestedApplicationId &&
      selectedWorkflow?.domain === "HIRING" &&
      selectedWorkflow.workflowId === requestedApplicationId
  );
  const showInstructorApplicantHandoff = Boolean(
    openedFromInstructorApplicantWorkspace && !schedulerDeepLinkResolved
  );
  const selectedQueueSection: QueueSectionKey =
    selectedWorkflow && ["COMPLETED", "CANCELLED"].includes(selectedWorkflow.status)
      ? "closed"
      : selectedWorkflow?.status === "BOOKED"
      ? "booked"
      : "attention";
  const bookedSoonCount = filteredWorkflows.filter((workflow) => isUpcoming(workflow.scheduledAt, 7)).length;
  const visibleStaleCount = filteredWorkflows.filter((workflow) => workflow.status === "STALE").length;
  const visibleAtRiskCount = filteredWorkflows.filter((workflow) => workflow.isAtRisk).length;
  const hasActiveFilters =
    Boolean(search.trim()) ||
    domainFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    chapterFilter !== "ALL" ||
    interviewerFilter !== "ALL";

  const filteredCalendars = data.calendars.filter((calendar) => {
    if (chapterFilter !== "ALL" && calendar.chapterId !== chapterFilter) return false;
    if (interviewerFilter !== "ALL" && calendar.interviewerId !== interviewerFilter) return false;
    if (deferredSearch) {
      const haystack = `${calendar.interviewerName} ${calendar.interviewerRole} ${calendar.chapterName ?? ""}`.toLowerCase();
      if (!haystack.includes(deferredSearch.toLowerCase())) return false;
    }
    return true;
  });

  const selectedCalendarIsVisible = filteredCalendars.some(
    (calendar) => calendar.interviewerId === selectedInterviewerId
  );
  const activeCalendarId = selectedCalendarIsVisible
    ? selectedInterviewerId
    : filteredCalendars[0]?.interviewerId ?? null;

  function applyFocus(status: WorkflowStatusFilter) {
    setPanel("queue");
    setStatusFilter(status);
  }

  function clearFilters() {
    setSearch("");
    setDomainFilter("ALL");
    setStatusFilter("ALL");
    setChapterFilter("ALL");
    setInterviewerFilter("ALL");
  }

  return (
    <main className="main-content">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 120px" }}>
        <div
          style={{
            ...SURFACE_CARD,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pill pill-purple" style={{ fontSize: 12 }}>Interview Scheduling OS</span>
              <span className="pill pill-info" style={{ fontSize: 12 }}>{data.summary.total} active workflows</span>
              {openedFromApplicantWorkspace ? (
                <span className="pill pill-success" style={{ fontSize: 12 }}>Applicant workspace linked</span>
              ) : null}
              {showInstructorApplicantHandoff ? (
                <span className="pill pill-info" style={{ fontSize: 12 }}>Applicant handoff</span>
              ) : null}
              {data.summary.atRisk > 0 ? (
                <span className="pill pill-overdue" style={{ fontSize: 12 }}>{data.summary.atRisk} past SLA</span>
              ) : null}
            </div>
            <h1 style={{ margin: "10px 0 0", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
              Shared calendar command center
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 640 }}>
              {showInstructorApplicantHandoff
                ? "Use this calendar scheduler to find open interviewer time. The applicant-specific offer is sent from the workspace slot panel after you choose the time."
                : "This is the full scheduler behind the workspace Post slot panel. When opened from an applicant workspace, that applicant is selected here so posted slots, calendar options, booking notes, and the interview thread stay together."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className={`button small ${panel === "queue" ? "" : "outline"}`}
              onClick={() => setPanel("queue")}
            >
              Workflow queue
            </button>
            <button
              type="button"
              className={`button small ${panel === "calendars" ? "" : "outline"}`}
              onClick={() => setPanel("calendars")}
            >
              Interviewer calendars
            </button>
            {data.viewer.isReviewer ? (
              <Link href="/chapter" className="button small outline" style={{ textDecoration: "none" }}>
                Open Chapter OS
              </Link>
            ) : null}
          </div>
        </div>
        {showInstructorApplicantHandoff ? (
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              border: "1px solid rgba(37, 99, 235, 0.18)",
              borderRadius: 8,
              background: "rgba(239, 246, 255, 0.86)",
              color: "var(--muted)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--text)" }}>
              Opened from an instructor applicant workspace.
            </strong>{" "}
            This scheduler manages shared interviewer calendars. Pick an
            interviewer-backed time here, then return to the workspace slot panel
            to send the official applicant offer.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          <SummaryTile eyebrow="Total" value={data.summary.total} label="active interview workflows" accent="#0f766e" />
          <SummaryTile eyebrow="Needs scheduling" value={data.summary.needsScheduling} label="workflows still waiting on a first booking" accent="#d97706" />
          <SummaryTile eyebrow="Booked" value={data.summary.booked} label="confirmed interview bookings" accent="#2563eb" />
          <SummaryTile eyebrow="Reschedule" value={data.summary.rescheduleRequested} label="workflows needing a replacement time" accent="#db2777" />
          <SummaryTile eyebrow="At risk" value={data.summary.atRisk} label="items beyond the 24 hour scheduling SLA" accent="#dc2626" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          <FocusButton
            label="All active"
            detail="Show the full queue"
            count={filteredWorkflows.length}
            active={statusFilter === "ALL"}
            accent="#0f766e"
            onClick={() => applyFocus("ALL")}
          />
          <FocusButton
            label="Need time"
            detail="No booking yet"
            count={filteredWorkflows.filter((workflow) => workflow.status === "UNSCHEDULED").length}
            active={statusFilter === "UNSCHEDULED"}
            accent="#d97706"
            onClick={() => applyFocus("UNSCHEDULED")}
          />
          <FocusButton
            label="Reschedule"
            detail="Replacement needed"
            count={filteredWorkflows.filter((workflow) => workflow.status === "RESCHEDULE_REQUESTED").length}
            active={statusFilter === "RESCHEDULE_REQUESTED"}
            accent="#db2777"
            onClick={() => applyFocus("RESCHEDULE_REQUESTED")}
          />
          <FocusButton
            label="At risk"
            detail="Past the SLA"
            count={visibleStaleCount}
            active={statusFilter === "STALE"}
            accent="#dc2626"
            onClick={() => applyFocus("STALE")}
          />
          <FocusButton
            label="Booked soon"
            detail="Next 7 days"
            count={bookedSoonCount}
            active={statusFilter === "BOOKED"}
            accent="#2563eb"
            onClick={() => applyFocus("BOOKED")}
          />
        </div>
      </div>

      {feedback ? <Banner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}

      <div style={{ ...SURFACE_CARD, padding: "1rem", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800 }}>Find the right interview</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              Filter by person, chapter, interviewer, workflow type, or status.
            </div>
          </div>
          {hasActiveFilters ? (
            <button type="button" className="button small outline" onClick={clearFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label className="form-row">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input"
              placeholder="Search interviewee, interviewer, chapter, or workflow"
            />
          </label>
          <label className="form-row">
            Domain
            <select className="input" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as "ALL" | "HIRING" | "READINESS")}>
              <option value="ALL">All domains</option>
              <option value="HIRING">Hiring</option>
              <option value="READINESS">Readiness</option>
            </select>
          </label>
          <label className="form-row">
            Status
            <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as WorkflowStatusFilter)}>
              <option value="ALL">All statuses</option>
              {Object.keys(STATUS_STYLES).map((status) => (
                <option key={status} value={status}>
                  {STATUS_STYLES[status as InterviewWorkflowView["status"]].label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            Chapter
            <select className="input" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}>
              <option value="ALL">All chapters</option>
              {chapterOptions.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            Interviewer
            <select className="input" value={interviewerFilter} onChange={(event) => setInterviewerFilter(event.target.value)}>
              <option value="ALL">All interviewers</option>
              {data.interviewerOptions.map((interviewer) => (
                <option key={interviewer.id} value={interviewer.id}>
                  {interviewer.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {panel === "queue" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 20, alignItems: "start" }}>
          <aside style={{ position: "sticky", top: 20, display: "grid", gap: 18 }}>
            <QueueSection
              title="Needs attention"
              subtitle="Unscheduled, awaiting response, reschedule, and at-risk work."
              workflows={attentionWorkflows}
              selectedWorkflowId={selectedWorkflow?.id ?? null}
              onSelect={setSelectedWorkflowId}
            />
            <QueueSection
              title="Booked soon"
              subtitle="Confirmed interviews with follow-up actions."
              workflows={bookedWorkflows}
              selectedWorkflowId={selectedWorkflow?.id ?? null}
              onSelect={setSelectedWorkflowId}
            />
            {closedWorkflows.length > 0 ? (
              <QueueSection
                title="Closed out"
                subtitle="Completed and cancelled interview records."
                workflows={closedWorkflows}
                selectedWorkflowId={selectedWorkflow?.id ?? null}
                onSelect={setSelectedWorkflowId}
              />
            ) : null}
          </aside>

          <section style={{ display: "grid", gap: 18, minWidth: 0 }}>
            {selectedWorkflow ? (
              <>
                <div
                  style={{
                    ...SURFACE_CARD,
                    padding: "1rem 1.1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
                      Selected interview
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>
                      {selectedQueueSection === "attention"
                        ? "Resolve the next scheduling step"
                        : selectedQueueSection === "booked"
                        ? "Keep the booking ready"
                        : "Review the finished record"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={selectedWorkflow.detailHref} className="button small outline" style={{ textDecoration: "none" }}>
                      {selectedWorkflow.domain === "HIRING" ? "Open workspace" : "Open record"}
                    </Link>
                    {selectedWorkflow.conversationId ? (
                      <Link href={`/messages/${selectedWorkflow.conversationId}`} className="button small outline" style={{ textDecoration: "none" }}>
                        Open thread
                      </Link>
                    ) : null}
                  </div>
                </div>

                <WorkflowCard
                  viewer={data.viewer}
                  workflow={selectedWorkflow}
                  isPending={isPending}
                  activeActionId={activeActionId}
                  onBook={(workflow, slot, note) =>
                    runAction(`book:${workflow.id}`, "Interview booked successfully.", async () => {
                      const formData = new FormData();
                      formData.set("domain", workflow.domain);
                      formData.set("workflowId", workflow.workflowId);
                      formData.set("interviewerId", slot.interviewerId);
                      formData.set("scheduledAt", slot.startsAt);
                      formData.set("duration", String(slot.duration));
                      if (note.trim()) formData.set("note", note.trim());
                      await bookInterviewWorkflowSlot(formData);
                    })
                  }
                  onConfirmReschedule={(workflow, slot, note) =>
                    runAction(`reschedule:${workflow.id}`, "Interview reschedule confirmed.", async () => {
                      const formData = new FormData();
                      formData.set("requestId", workflow.activeRequestId!);
                      formData.set("interviewerId", slot.interviewerId);
                      formData.set("scheduledAt", slot.startsAt);
                      formData.set("duration", String(slot.duration));
                      if (note.trim()) formData.set("note", note.trim());
                      await confirmInterviewReschedule(formData);
                    })
                  }
                  onRequestReschedule={(requestId, note) =>
                    runAction(`reschedule:${selectedWorkflow.id}`, "Reschedule request sent to the interview thread.", async () => {
                      const formData = new FormData();
                      formData.set("requestId", requestId);
                      if (note.trim()) formData.set("note", note.trim());
                      await requestInterviewReschedule(formData);
                    })
                  }
                  onCancel={(requestId, note) =>
                    runAction(`cancel:${selectedWorkflow.id}`, "Interview booking cancelled.", async () => {
                      const formData = new FormData();
                      formData.set("requestId", requestId);
                      if (note.trim()) formData.set("note", note.trim());
                      await cancelInterviewWorkflow(formData);
                    })
                  }
                  onSendMessage={(conversationId, content, actionId) =>
                    runAction(actionId, "Message sent to the interview thread.", async () => {
                      const formData = new FormData();
                      formData.set("conversationId", conversationId);
                      formData.set("content", content);
                      await sendMessage(formData);
                    })
                  }
                />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
                  <div style={{ ...SURFACE_CARD, padding: "1.2rem" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Calendar radar</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                      Jump to an interviewer calendar when a queue item needs more openings.
                    </div>
                    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                      {filteredCalendars.slice(0, 3).map((calendar) => (
                        <button
                          key={calendar.interviewerId}
                          type="button"
                          onClick={() => {
                            setSelectedInterviewerId(calendar.interviewerId);
                            setPanel("calendars");
                          }}
                          style={{
                            textAlign: "left",
                            borderRadius: 16,
                            padding: "0.85rem",
                            border: "1px solid rgba(148,163,184,0.16)",
                            background: "rgba(255,255,255,0.96)",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <span>
                              <span style={{ display: "block", fontWeight: 800 }}>{calendar.interviewerName}</span>
                              <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                                {calendar.chapterName ?? "Global"} · {calendar.interviewerRole}
                              </span>
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#047857" }}>
                              {calendar.nextOpenSlots.length} open
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="button small outline" style={{ marginTop: 14 }} onClick={() => setPanel("calendars")}>
                      Open calendar studio
                    </button>
                  </div>

                  <div style={{ ...SURFACE_CARD, padding: "1.2rem" }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>Ops pulse</div>
                    <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
                      {[
                        { label: "At risk", value: visibleAtRiskCount, detail: "visible queue items past SLA", color: "#dc2626" },
                        { label: "Booked soon", value: bookedSoonCount, detail: "confirmed in the next 7 days", color: "#2563eb" },
                        {
                          label: "Threads",
                          value: filteredWorkflows.filter((workflow) => workflow.conversationId).length,
                          detail: "visible workflows with shared messages",
                          color: "#7c3aed",
                        },
                      ].map((metric) => (
                        <div
                          key={metric.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 14,
                            alignItems: "center",
                            paddingBottom: 12,
                            borderBottom: "1px solid rgba(148,163,184,0.14)",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: metric.color }}>{metric.label}</div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{metric.detail}</div>
                          </div>
                          <div style={{ fontSize: 26, fontWeight: 900, color: metric.color }}>{metric.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyPanel
                title="No interviews match these filters"
                body="Reset the filters or switch to interviewer calendars to create more bookable time."
              />
            )}
          </section>
        </div>
      ) : (
        <CalendarManager
          viewer={data.viewer}
          calendars={filteredCalendars}
          selectedInterviewerId={activeCalendarId}
          onSelectInterviewer={setSelectedInterviewerId}
          isPending={isPending}
          activeActionId={activeActionId}
          onCreateRule={(formData) =>
            runAction(`rule-create:${formData.get("interviewerId")}`, "Weekly availability rule added.", async () => {
              await createInterviewAvailabilityRule(formData);
            })
          }
          onRemoveRule={(ruleId, actionId) =>
            runAction(actionId, "Weekly availability rule removed.", async () => {
              const formData = new FormData();
              formData.set("ruleId", ruleId);
              await deactivateInterviewAvailabilityRule(formData);
            })
          }
          onCreateOverride={(formData) =>
            runAction(`override-create:${formData.get("interviewerId")}`, "Availability override added.", async () => {
              await createInterviewAvailabilityOverride(formData);
            })
          }
          onRemoveOverride={(overrideId, actionId) =>
            runAction(actionId, "Availability override removed.", async () => {
              const formData = new FormData();
              formData.set("overrideId", overrideId);
              await deactivateInterviewAvailabilityOverride(formData);
            })
          }
        />
      )}
      </div>
    </main>
  );
}
