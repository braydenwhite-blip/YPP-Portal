"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, Children, type CSSProperties, type ReactNode } from "react";

import { meetingCategoryTone } from "@/lib/people-strategy/meeting-categories";
import type {
  AgendaItemDTO,
  DecisionDTO,
  FollowUpDTO,
  LinkedActionDTO,
  MeetingAttendeeDTO,
  MeetingDetailDTO,
} from "@/lib/people-strategy/meetings-queries";
import {
  addAgendaItem,
  addDecision,
  convertAgendaItemToAction,
  convertDecisionToAction,
  convertFollowUpToAction,
  deleteDecision,
  saveMeetingNotes,
  setAgendaItemStatus,
  setFollowUpStatus,
  setMeetingAttendeeStatus,
  setMeetingStatus,
} from "@/lib/people-strategy/meetings-actions";
import {
  MEETING_ATTENDANCE_STATUS_LABELS,
  MEETING_ATTENDANCE_STATUS_VALUES,
} from "@/lib/people-strategy/meeting-attendance";
import {
  meetingOperatingModel,
  type MeetingOperatingModel,
} from "@/lib/people-strategy/meeting-operating-model";
import { findSimilarActionTitles } from "@/lib/people-strategy/action-prefill";
import { AskAboutThis } from "@/components/help-agent/ask-about-this";
import { AddFollowUpDrawer } from "./meeting-followup-drawer";
import { MeetingIcon, type MeetingIconName } from "./meeting-icons";
import { fieldStyle } from "./meeting-form-kit";
import {
  AgendaStatusBadge,
  Avatar,
  Card,
  CategoryBadge,
  EmptyState,
  FollowUpStatusBadge,
  MeetingButton,
  PersonChip,
  Pill,
  SectionTitle,
  TinyLabel,
  dueText,
  fmtTime,
  fmtWeekday,
} from "./meeting-ui";
import type { PersonOption } from "./new-meeting-drawer";
import { RelatedEntityBadge } from "./operational-badges";

/** The portal context a meeting is connected to (resolved server-side). */
export type MeetingRelatedContext = {
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  entityHref: string | null;
  area: string;
  openActions: Array<{ id: string; title: string; status: string; leadName: string }>;
  otherMeetings: Array<{ id: string; title: string; dateISO: string }>;
};

export function MeetingDetailClient({
  meeting,
  people,
  relatedContext = null,
  impactAgendaPanel = null,
  summaryPanel = null,
  preparedPresentationsPanel = null,
  followUpPackPanel = null,
  strategicContextPanel = null,
}: {
  meeting: MeetingDetailDTO;
  people: PersonOption[];
  relatedContext?: MeetingRelatedContext | null;
  impactAgendaPanel?: ReactNode;
  summaryPanel?: ReactNode;
  preparedPresentationsPanel?: ReactNode;
  followUpPackPanel?: ReactNode;
  strategicContextPanel?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<null | { create: boolean }>(null);
  const [gateOpen, setGateOpen] = useState(false);

  const c = meetingCategoryTone(meeting.category);
  const operatingModel = meetingOperatingModel(meeting.meetingType);
  const overdue = meeting.overdueFollowUps;
  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn().then(() => router.refresh()));
  const stage = meetingStage(meeting);
  const groupLabel = meetingGroupLabel(meeting, operatingModel);
  const missingPrep = meetingPrepLines(meeting);
  const openFollowUps = meeting.followUps.filter((f) => f.effectiveStatus !== "completed");
  const unresolvedAgenda = meeting.agenda.filter((item) => item.status === "DEFERRED");

  return (
    <div className="meeting-detail-flow" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1120, margin: "0 auto", paddingBottom: 48 }}>
      <Link
        href="/meetings"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--ypp-purple-600)", textDecoration: "none", alignSelf: "flex-start" }}
      >
        <MeetingIcon name="chevL" size={16} />
        Meetings
      </Link>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: c.bg, borderBottom: `1px solid ${c.border}`, padding: "22px", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 380px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Pill tone="purple" style={{ fontWeight: 800 }}>{stage}</Pill>
              <CategoryBadge category={meeting.category} />
              <Pill tone="neutral">{groupLabel}</Pill>
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--ypp-ink)", letterSpacing: 0, lineHeight: 1.15 }}>
              {meeting.title}
            </h1>
            <p style={{ margin: "9px 0 0", fontSize: 14.5, color: "var(--text-secondary)", maxWidth: 680, lineHeight: 1.5 }}>
              {meeting.purpose || operatingModel.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              <PlainMeta label="When" value={`${fmtWeekday(meeting.startISO)} at ${fmtTime(meeting.startISO)}`} />
              <PlainMeta label="Owner" value={meeting.facilitator?.name ?? "No owner yet"} />
              <PlainMeta label="Team" value={groupLabel} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {meeting.effectiveStatus === "completed" || meeting.effectiveStatus === "needs_follow_up" ? (
                <MeetingButton variant="outline" icon="repeat" disabled={pending} onClick={() => run(() => setMeetingStatus(meeting.id, "SCHEDULED"))}>
                  Reopen
                </MeetingButton>
              ) : (
                <MeetingButton icon="check" disabled={pending} onClick={() => setGateOpen(true)}>
                  Mark Complete
                </MeetingButton>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <AskAboutThis entityType="meeting" entityId={meeting.id} />
              <MeetingButton variant="outline" icon="flag" onClick={() => setDrawer({ create: false })}>
                Add follow-up
              </MeetingButton>
              <MeetingButton variant="outline" icon="bolt" onClick={() => setDrawer({ create: true })}>
                Create action
              </MeetingButton>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "11px 22px", fontSize: 13, color: "var(--text-secondary)" }}>
          Next: {meetingNextSentence(meeting)} It has{" "}
          <strong style={{ color: "var(--ypp-ink)" }}>
            {meeting.agendaCount} agenda item{meeting.agendaCount === 1 ? "" : "s"}
          </strong>
          ,{" "}
          <strong style={{ color: "var(--ypp-ink)" }}>
            {meeting.decisionCount} decision{meeting.decisionCount === 1 ? "" : "s"}
          </strong>
          , and{" "}
          <strong style={{ color: meeting.openFollowUps > 0 ? "var(--warn-fg, #854d0e)" : "var(--ypp-ink)" }}>
            {meeting.openFollowUps} follow-up{meeting.openFollowUps === 1 ? "" : "s"}
          </strong>
          .
        </div>
      </Card>

      <nav aria-label="Meeting phases" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          ["Before", "#before"],
          ["During", "#during"],
          ["After", "#after"],
        ].map(([label, href]) => (
          <a key={href} href={href} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "8px 13px", background: "var(--surface)", color: "var(--ypp-ink)", fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
            {label}
          </a>
        ))}
      </nav>

      <PhaseSection id="before" title="Before" subtitle="Know why this meeting exists, who needs to be there, and what still needs prep.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <InfoCard title="Purpose" icon="compass">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
              {meeting.purpose || operatingModel.description}
            </p>
          </InfoCard>
          <InfoCard title="People" icon="people">
            {meeting.facilitator ? (
              <PersonChip name={meeting.facilitator.name} sub="Owner" size={34} />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>No owner assigned yet.</p>
            )}
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
              {meeting.attendeeCount > 0
                ? `${meeting.attendeeCount} attendee${meeting.attendeeCount === 1 ? "" : "s"} added.`
                : "No attendees added yet."}
            </p>
          </InfoCard>
          <InfoCard title="Prep needed" icon="list">
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
              {missingPrep.map((line) => (
                <li key={line} style={{ display: "flex", gap: 7, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  <MeetingIcon name="check" size={13} style={{ color: "var(--ypp-purple-600)", marginTop: 2 }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>

        {relatedContext ? <RelatedContextSection relatedContext={relatedContext} /> : null}
        <AttendanceSection meeting={meeting} model={operatingModel} pending={pending} run={run} />
        {preparedPresentationsPanel}
      </PhaseSection>

      <PhaseSection id="during" title="During" subtitle="Work the agenda, write notes, mark items discussed, and capture decisions while the meeting is happening.">
        <div id="agenda" style={{ scrollMarginTop: 80 }}>
          {impactAgendaPanel ?? <AgendaSection meeting={meeting} pending={pending} run={run} />}
        </div>
        <div id="notes" style={{ scrollMarginTop: 80 }}>
          <NotesSection meeting={meeting} pending={pending} run={run} />
        </div>
        <div id="decisions" style={{ scrollMarginTop: 80 }}>
          <DecisionsSection meeting={meeting} people={people} pending={pending} run={run} />
        </div>
        {overdue > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 700, color: "var(--danger-fg)", background: "var(--danger-bg)", border: "1px solid #f3cccc", borderRadius: 12, padding: "11px 14px" }}>
            <MeetingIcon name="alert" size={15} />
            {overdue} follow-up{overdue === 1 ? "" : "s"} from this meeting are overdue.
          </div>
        ) : null}
      </PhaseSection>

      <PhaseSection id="after" title="After" subtitle="Send the summary, close loose ends, and make sure follow-ups are real actions.">
        {summaryPanel}
        <div id="followups" style={{ scrollMarginTop: 80 }}>
          <FollowUpsSection meeting={meeting} pending={pending} run={run} onAdd={() => setDrawer({ create: false })} />
        </div>
        {unresolvedAgenda.length > 0 ? (
          <InfoCard title="Unresolved agenda items" icon="clock">
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>
              {unresolvedAgenda.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </InfoCard>
        ) : null}
        <div id="actions" style={{ scrollMarginTop: 80 }}>
          <LinkedActionsSection actions={meeting.linkedActions} />
        </div>
        {followUpPackPanel}
        {strategicContextPanel}
        {openFollowUps.length === 0 && unresolvedAgenda.length === 0 ? (
          <InfoCard title="Closeout" icon="checkCircle">
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
              No open follow-ups or carried agenda items are waiting on this meeting.
            </p>
          </InfoCard>
        ) : null}
      </PhaseSection>

      {drawer && (
        <AddFollowUpDrawer
          meeting={{ id: meeting.id, title: meeting.title, startISO: meeting.startISO, category: meeting.category, facilitatorId: meeting.facilitator?.id }}
          people={people}
          defaultCreate={drawer.create}
          onClose={() => setDrawer(null)}
        />
      )}

      {gateOpen && (
        <CompletionGate
          meeting={meeting}
          pending={pending}
          onCancel={() => setGateOpen(false)}
          onComplete={() => {
            setGateOpen(false);
            run(() => setMeetingStatus(meeting.id, "COMPLETED"));
          }}
        />
      )}
    </div>
  );
}

/**
 * Meeting completion quality gate. A meeting's notes must not become dead text:
 * before completing, the facilitator reviews what should become organizational
 * memory — Decisions, Next Actions, and Follow-Ups. Areas that already have
 * content pass automatically; empty/unresolved areas must be acknowledged
 * explicitly (a clean checklist, not a nag). It reuses the meeting's existing
 * outcome-quality signal rather than re-deriving anything.
 */
function CompletionGate({
  meeting,
  pending,
  onCancel,
  onComplete,
}: {
  meeting: MeetingDetailDTO;
  pending: boolean;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const hasDecisions = meeting.decisionCount > 0;
  const hasActions = meeting.linkedActions.length > 0;
  const openFollowUps = meeting.openFollowUps;
  const attendanceMissing =
    meeting.attendeeCount > 0 &&
    (meeting.attendanceRecordedCount ?? 0) < (meeting.requiredAttendeeCount ?? meeting.attendeeCount);

  const [noDecisions, setNoDecisions] = useState(false);
  const [noActions, setNoActions] = useState(false);
  const [noActionsReason, setNoActionsReason] = useState("");
  const [followUpsAck, setFollowUpsAck] = useState(false);
  const [attendanceAck, setAttendanceAck] = useState(false);

  const decisionsOk = hasDecisions || noDecisions;
  const actionsOk = hasActions || (noActions && noActionsReason.trim().length > 0);
  const followUpsOk = openFollowUps === 0 || followUpsAck;
  const attendanceOk = !attendanceMissing || attendanceAck;
  const canComplete = decisionsOk && actionsOk && followUpsOk && attendanceOk;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review before completing meeting"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--surface, #fff)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 18px 50px rgba(15,23,42,.22)" }}
      >
        <div style={{ padding: "18px 20px 12px" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ypp-ink)" }}>
            Before completing this meeting
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Review what should become memory. Nothing here is busywork — it just
            keeps the meeting from turning into a dead note.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 20px 16px" }}>
          {/* Decisions */}
          <GateRow
            label="Decisions Made"
            ok={decisionsOk}
            status={hasDecisions ? `${meeting.decisionCount} on record` : "None logged"}
          >
            {!hasDecisions && (
              <label style={gateCheckStyle}>
                <input type="checkbox" checked={noDecisions} onChange={(e) => setNoDecisions(e.target.checked)} />
                No decisions made in this meeting
              </label>
            )}
          </GateRow>

          {/* Next Actions */}
          <GateRow
            label="Next Actions"
            ok={actionsOk}
            status={hasActions ? `${meeting.linkedActions.length} created` : "None created"}
          >
            {!hasActions && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={gateCheckStyle}>
                  <input type="checkbox" checked={noActions} onChange={(e) => setNoActions(e.target.checked)} />
                  No next actions needed
                </label>
                {noActions && (
                  <input
                    value={noActionsReason}
                    onChange={(e) => setNoActionsReason(e.target.value)}
                    placeholder="Short reason (e.g. informational sync only)"
                    style={{ ...fieldStyle, fontSize: 13 }}
                  />
                )}
              </div>
            )}
          </GateRow>

          {/* Follow-ups */}
          <GateRow
            label="Attendance"
            ok={attendanceOk}
            status={
              attendanceMissing
                ? `${meeting.attendanceRecordedCount ?? 0}/${meeting.requiredAttendeeCount ?? meeting.attendeeCount} recorded`
                : "Recorded"
            }
          >
            {attendanceMissing && (
              <label style={gateCheckStyle}>
                <input type="checkbox" checked={attendanceAck} onChange={(e) => setAttendanceAck(e.target.checked)} />
                Complete anyway and record remaining attendance later
              </label>
            )}
          </GateRow>

          <GateRow
            label="Follow-Ups"
            ok={followUpsOk}
            status={openFollowUps === 0 ? "All resolved" : `${openFollowUps} unresolved`}
          >
            {openFollowUps > 0 && (
              <label style={gateCheckStyle}>
                <input type="checkbox" checked={followUpsAck} onChange={(e) => setFollowUpsAck(e.target.checked)} />
                Leave {openFollowUps} unresolved on purpose (owner &amp; due date set — convert them below if not)
              </label>
            )}
          </GateRow>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--border)", padding: "12px 20px" }}>
          <MeetingButton variant="outline" onClick={onCancel}>
            Keep reviewing
          </MeetingButton>
          <MeetingButton icon="check" disabled={!canComplete || pending} onClick={onComplete}>
            Complete meeting
          </MeetingButton>
        </div>
      </div>
    </div>
  );
}

const gateCheckStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "var(--text-secondary)",
  cursor: "pointer",
};

function GateRow({ label, ok, status, children }: { label: string; ok: boolean; status: string; children?: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", background: ok ? "var(--ok-bg, #f0fdf4)" : "var(--surface, #fff)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ fontSize: 14, color: ok ? "var(--ok-fg, #15803d)" : "var(--muted)" }}>
            {ok ? "✓" : "○"}
          </span>
          <strong style={{ fontSize: 13.5, color: "var(--ypp-ink)" }}>{label}</strong>
        </div>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{status}</span>
      </div>
      {children ? <div style={{ marginTop: 9, paddingLeft: 22 }}>{children}</div> : null}
    </div>
  );
}

type RunFn = (fn: () => Promise<unknown>) => void;

function SectionBlock({ title, icon, count, right, children }: { title: string; icon: MeetingIconName; count?: number; right?: ReactNode; children: ReactNode }) {
  return (
    <Card style={{ padding: "17px 18px" }}>
      <SectionTitle icon={icon} count={count} right={right}>
        {title}
      </SectionTitle>
      {children}
    </Card>
  );
}

function PlainMeta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ border: "1px solid var(--border)", borderRadius: 999, background: "var(--surface)", padding: "6px 10px", fontSize: 12.5, fontWeight: 700, color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      <span style={{ color: "var(--ypp-ink)" }}>{value}</span>
    </span>
  );
}

function PhaseSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: 88, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ margin: 0, color: "var(--ypp-purple-700)", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
          {title}
        </p>
        <h2 style={{ margin: "3px 0 0", color: "var(--ypp-ink)", fontSize: 23, fontWeight: 850, letterSpacing: 0 }}>
          {title === "Before" ? "Prepare the room" : title === "During" ? "Run the meeting" : "Follow up"}
        </h2>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13.5, lineHeight: 1.55 }}>
          {subtitle}
        </p>
      </div>
      {Children.toArray(children)}
    </section>
  );
}

function InfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: MeetingIconName;
  children: ReactNode;
}) {
  return (
    <Card style={{ padding: "16px 17px" }}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {children}
    </Card>
  );
}

function RelatedContextSection({
  relatedContext,
}: {
  relatedContext: MeetingRelatedContext;
}) {
  return (
    <InfoCard title="Related context" icon="link">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <RelatedEntityBadge
          type={relatedContext.entityType}
          id={relatedContext.entityId}
          label={relatedContext.entityLabel}
          href={relatedContext.entityHref}
        />
        {relatedContext.openActions.length ? (
          <div>
            <TinyLabel>Open actions</TinyLabel>
            <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {relatedContext.openActions.slice(0, 4).map((a) => (
                <li key={a.id} style={{ fontSize: 12.5, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <Link href={`/actions/${a.id}`} style={{ color: "var(--ypp-ink)", fontWeight: 650, textDecoration: "none", minWidth: 0 }}>
                    {a.title}
                  </Link>
                  <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{a.leadName}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {relatedContext.otherMeetings.length ? (
          <div>
            <TinyLabel>Other meetings</TinyLabel>
            <ul style={{ margin: "7px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {relatedContext.otherMeetings.slice(0, 3).map((m) => (
                <li key={m.id} style={{ fontSize: 12.5 }}>
                  <Link href={`/meetings/${m.id}`} style={{ color: "var(--ypp-ink)", fontWeight: 650, textDecoration: "none" }}>
                    {m.title}
                  </Link>
                  <span style={{ color: "var(--muted)" }}> · {fmtWeekday(m.dateISO)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </InfoCard>
  );
}

function meetingStage(meeting: MeetingDetailDTO): "Prepare" | "Ready" | "Live" | "Follow-up" {
  if (meeting.effectiveStatus === "in_progress") return "Live";
  if (meeting.effectiveStatus === "completed" || meeting.effectiveStatus === "needs_follow_up") {
    return "Follow-up";
  }
  if (meeting.agendaCount === 0 || meeting.attendeeCount === 0 || !meeting.facilitator) {
    return "Prepare";
  }
  return "Ready";
}

function meetingGroupLabel(meeting: MeetingDetailDTO, model: MeetingOperatingModel): string {
  if (meeting.relatedTeam) return meeting.relatedTeam;
  if (meeting.relatedChapter) return meeting.relatedChapter;
  return meeting.meetingTypeLabel ?? model.label;
}

function meetingPrepLines(meeting: MeetingDetailDTO): string[] {
  const lines: string[] = [];
  if (meeting.agendaCount === 0) lines.push("Add an agenda so everyone knows what will be discussed.");
  else lines.push(`${meeting.agendaCount} agenda item${meeting.agendaCount === 1 ? "" : "s"} ready to review.`);
  if (meeting.attendeeCount === 0) lines.push("Add attendees or confirm who needs to be in the room.");
  else lines.push(`${meeting.attendeeCount} attendee${meeting.attendeeCount === 1 ? "" : "s"} listed for this meeting.`);
  if (!meeting.facilitator) lines.push("Choose an owner for the meeting.");
  if (meeting.openFollowUps > 0) {
    lines.push(`Review ${meeting.openFollowUps} open follow-up${meeting.openFollowUps === 1 ? "" : "s"} before the meeting.`);
  }
  return lines.slice(0, 4);
}

function meetingNextSentence(meeting: MeetingDetailDTO): string {
  const stage = meetingStage(meeting);
  if (stage === "Live") return "Work through the agenda and capture decisions.";
  if (stage === "Prepare") return meeting.agendaCount === 0 ? "Add an agenda before this meeting starts." : "Confirm people and context before it starts.";
  if (stage === "Follow-up") return meeting.openFollowUps > 0 ? "Close or convert the open follow-ups." : "Copy the summary and keep the record clean.";
  return "Open it when the meeting starts.";
}

function AttendanceSection({
  meeting,
  model,
  pending,
  run,
}: {
  meeting: MeetingDetailDTO;
  model: MeetingOperatingModel;
  pending: boolean;
  run: RunFn;
}) {
  return (
    <div id="attendance" style={{ scrollMarginTop: 80 }}>
      <Card style={{ padding: "16px 17px" }}>
        <SectionTitle icon="people" count={meeting.attendees.length}>
          Attendance
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {model.requiredAttendees.length > 0 ? (
            <div>
              <TinyLabel>Expected required attendees</TinyLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                {model.requiredAttendees.map((name) => (
                  <Pill key={name} tone="neutral" style={{ fontSize: 11.5 }}>
                    {name}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}
          {meeting.attendees.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {meeting.attendees.map((p) => (
                <AttendeeStatusRow key={p.attendeeId} attendee={p} pending={pending} run={run} />
              ))}
            </div>
          ) : (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              No attendees added yet. Add required attendees before this meeting runs.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function AttendeeStatusRow({
  attendee,
  pending,
  run,
}: {
  attendee: MeetingAttendeeDTO;
  pending: boolean;
  run: RunFn;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <PersonChip name={attendee.name} size={28} />
      <select
        value={attendee.attendanceStatus}
        disabled={pending}
        onChange={(e) =>
          run(() => setMeetingAttendeeStatus({ id: attendee.attendeeId, status: e.target.value }))
        }
        style={{ ...fieldStyle, flex: "0 0 150px", padding: "7px 9px", fontSize: 12.5 }}
        aria-label={`Attendance for ${attendee.name}`}
      >
        {MEETING_ATTENDANCE_STATUS_VALUES.map((status) => (
          <option key={status} value={status}>
            {MEETING_ATTENDANCE_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}

// --- Agenda -----------------------------------------------------------------

function AgendaSection({ meeting, pending, run }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  return (
    <SectionBlock
      title="Agenda"
      icon="list"
      count={meeting.agendaCount}
      right={
        <MeetingButton size="sm" variant="ghost" icon="plus" onClick={() => setAdding((v) => !v)}>
          Add item
        </MeetingButton>
      }
    >
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(() => addAgendaItem({ meetingId: meeting.id, title }));
            setTitle("");
            setAdding(false);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 12 }}
        >
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New agenda item…" style={fieldStyle} />
          <MeetingButton type="submit" icon="plus" disabled={!title.trim() || pending}>
            Add
          </MeetingButton>
        </form>
      )}
      {meeting.agenda.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {meeting.agenda.map((a) => (
            <AgendaItem key={a.id} item={a} meetingId={meeting.id} pending={pending} run={run} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="list" title="No agenda items yet" body="Add the talking points so the meeting stays on track." />
      )}
    </SectionBlock>
  );
}

function agendaKindLabel(kind: string | null): string | null {
  if (!kind) return null;
  const labels: Record<string, string> = {
    INITIATIVE_OVERVIEW: "Initiative overview",
    TEAM_STATUS: "Team status",
    DELIVERABLE_REVIEW: "Deliverable review",
    DECISION: "Decision needed",
    LEADERSHIP_INPUT: "Leadership input",
    CROSS_TEAM_COORDINATION: "Cross-team coordination",
    ESCALATED_BLOCKER: "Escalated blocker",
    MISSED_COMMITMENT_REVIEW: "Missed commitment",
    WRITTEN_REVIEW: "Written review",
    EXPECTATION_SETTING: "Next expectation",
  };
  return labels[kind] ?? kind.replaceAll("_", " ").toLowerCase();
}

function AgendaItem({ item, meetingId, pending, run }: { item: AgendaItemDTO; meetingId: string; pending: boolean; run: RunFn }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const done = item.status === "DISCUSSED" || item.status === "CONVERTED";
  const kindLabel = agendaKindLabel(item.itemKind);
  const briefHref =
    item.sourceInitiativeId && item.sourceWorkstreamId && item.briefWeekStartISO
      ? `/operations/initiatives/${item.sourceInitiativeId}/teams/${item.sourceWorkstreamId}/brief/${item.briefWeekStartISO.slice(0, 10)}`
      : null;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
        <button
          onClick={() => run(() => setAgendaItemStatus({ id: item.id, status: item.status === "DISCUSSED" ? "OPEN" : "DISCUSSED" }))}
          aria-label="Toggle discussed"
          disabled={pending}
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            flex: "0 0 auto",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${done ? "var(--success-fg)" : "var(--border)"}`,
            background: done ? "var(--success-fg)" : "var(--surface)",
            color: "#fff",
          }}
        >
          {done && <MeetingIcon name="check" size={13} stroke={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0, cursor: item.notes ? "pointer" : "default" }} onClick={() => item.notes && setNotesOpen((v) => !v)}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-ink)", textDecoration: item.status === "DEFERRED" ? "line-through" : "none", opacity: item.status === "DEFERRED" ? 0.6 : 1 }}>
            {item.title}
          </div>
          {item.notes && !notesOpen && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.notes}</div>
          )}
          {(kindLabel || item.sourceActionTitle || item.presenter || item.preparedPresentation) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
              {kindLabel && <Pill tone={item.itemKind === "DELIVERABLE_REVIEW" ? "purple" : item.itemKind === "DECISION" ? "warning" : "neutral"}>{kindLabel}</Pill>}
              {item.presenter && <Pill tone="info">Presenter: {item.presenter.name}</Pill>}
              {item.sourceActionTitle && (
                <Link href={`/actions/${item.sourceActionId}`} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", textDecoration: "none" }}>
                  Task: {item.sourceActionTitle}
                </Link>
              )}
              {briefHref && (
                <Link href={briefHref} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", textDecoration: "none" }}>
                  Source team brief
                </Link>
              )}
            </div>
          )}
        </div>
        {(item.presenter ?? item.owner) && <Avatar name={(item.presenter ?? item.owner)!.name} size={24} />}
        <AgendaStatusBadge status={item.status} />
        <div style={{ position: "relative", flex: "0 0 auto" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Agenda item options"
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <MeetingIcon name="list" size={15} />
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
              <div style={{ position: "absolute", right: 0, top: 36, zIndex: 31, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, boxShadow: "0 12px 30px -8px rgba(28,20,60,.22)", padding: 5, minWidth: 180 }}>
                <MenuOpt icon="check" label="Mark discussed" onClick={() => { run(() => setAgendaItemStatus({ id: item.id, status: "DISCUSSED" })); setMenuOpen(false); }} />
                <MenuOpt icon="clock" label="Defer" onClick={() => { run(() => setAgendaItemStatus({ id: item.id, status: "DEFERRED" })); setMenuOpen(false); }} />
                {!item.convertedActionId && (
                  <MenuOpt icon="bolt" label="Convert to action" onClick={() => { run(() => convertAgendaItemToAction(item.id)); setMenuOpen(false); }} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {notesOpen && item.notes && (
        <div style={{ padding: "0 14px 13px 48px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>{item.notes}</div>
      )}
      {item.preparedPresentation && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "11px 14px 13px 48px", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--ypp-ink)" }}>Why officers are seeing this:</strong>{" "}
            {item.preparedPresentation.reasonForOfficerReview}
          </div>
          {item.requestedDecision && (
            <div style={{ fontSize: 12.5, color: "var(--warn-fg, #854d0e)", lineHeight: 1.5 }}>
              <strong>Decision/input requested:</strong> {item.requestedDecision}
            </div>
          )}
          {item.presentationExpectationPrompt && (
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--ypp-ink)" }}>Expectation:</strong> {item.presentationExpectationPrompt}
            </div>
          )}
          {item.deliverables.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {item.deliverables.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", textDecoration: "none", background: "var(--rail)" }}
                >
                  <MeetingIcon name="link" size={13} />
                  Open {link.label}
                </a>
              ))}
            </div>
          ) : item.itemKind === "DELIVERABLE_REVIEW" ? (
            <div style={{ fontSize: 12.5, color: "var(--danger-fg, #b42318)", fontWeight: 700 }}>
              Deliverable missing. Ask the team to attach the actual work product before presentation.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MenuOpt({ icon, label, onClick }: { icon: MeetingIconName; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", font: "inherit", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", background: "none", border: "none", padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap", borderRadius: 7 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--rail)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      <MeetingIcon name={icon} size={14} />
      {label}
    </button>
  );
}

// --- Notes ------------------------------------------------------------------

function NotesSection({ meeting, pending, run }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn }) {
  const [notes, setNotes] = useState(meeting.notesText ?? "");
  const dirty = notes !== (meeting.notesText ?? "");
  return (
    <SectionBlock
      title="Notes"
      icon="doc"
      right={
        dirty ? (
          <MeetingButton size="sm" icon="check" disabled={pending} onClick={() => run(() => saveMeetingNotes({ meetingId: meeting.id, notes }))}>
            Save
          </MeetingButton>
        ) : undefined
      }
    >
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Capture meeting notes, summary, and key discussion points…"
        rows={4}
        style={{ ...fieldStyle, resize: "vertical", fontSize: 14, lineHeight: 1.6 }}
      />
    </SectionBlock>
  );
}

// --- Decisions --------------------------------------------------------------

function DecisionsSection({ meeting, people, pending, run }: { meeting: MeetingDetailDTO; people: PersonOption[]; pending: boolean; run: RunFn }) {
  const [adding, setAdding] = useState(false);
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [decidedById, setDecidedById] = useState(meeting.facilitator?.id ?? "");
  return (
    <SectionBlock
      title="Decisions"
      icon="checkCircle"
      count={meeting.decisionCount}
      right={
        <MeetingButton size="sm" variant="ghost" icon="plus" onClick={() => setAdding((v) => !v)}>
          Log decision
        </MeetingButton>
      }
    >
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!decision.trim()) return;
            run(() => addDecision({ meetingId: meeting.id, decision, rationale, decidedById: decidedById || undefined }));
            setDecision("");
            setRationale("");
            setAdding(false);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12, padding: 13, border: "1px solid var(--border)", borderRadius: 12, background: "var(--rail)" }}
        >
          <textarea autoFocus value={decision} onChange={(e) => setDecision(e.target.value)} rows={2} placeholder="What was decided?" style={{ ...fieldStyle, resize: "vertical" }} />
          <input value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why (optional)" style={fieldStyle} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={decidedById} onChange={(e) => setDecidedById(e.target.value)} style={{ ...fieldStyle, flex: 1 }}>
              <option value="">Decided by…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <MeetingButton type="submit" icon="check" disabled={!decision.trim() || pending}>
              Log
            </MeetingButton>
          </div>
        </form>
      )}
      {meeting.decisions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {meeting.decisions.map((d) => (
            <DecisionCard key={d.id} dec={d} linkedActions={meeting.linkedActions} pending={pending} run={run} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="checkCircle" title="No decisions logged yet" body="Capture the calls made in this meeting so the team has a clear record." />
      )}
    </SectionBlock>
  );
}

function DecisionCard({
  dec,
  linkedActions,
  pending,
  run,
}: {
  dec: DecisionDTO;
  linkedActions: MeetingDetailDTO["linkedActions"];
  pending: boolean;
  run: RunFn;
}) {
  // Surface possible existing actions from this meeting so a leader doesn't
  // create a duplicate of work the meeting already produced.
  const possibleDuplicates = dec.linkedActionId
    ? []
    : findSimilarActionTitles(dec.decision, linkedActions);
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid var(--success-fg)", borderRadius: 12, padding: "14px 16px", background: "var(--surface)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--success-bg)", color: "var(--success-fg)", marginTop: 1 }}>
          <MeetingIcon name="checkCircle" size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.4 }}>{dec.decision}</div>
          {dec.rationale && (
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Why: </span>
              {dec.rationale}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {dec.decidedBy && <Avatar name={dec.decidedBy.name} size={20} />}
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {dec.decidedBy ? `Decided by ${dec.decidedBy.name}` : "Decision"}
            </span>
          </div>
        </div>
        <button
          onClick={() => run(() => deleteDecision(dec.id))}
          aria-label="Delete decision"
          disabled={pending}
          style={{ border: "none", background: "none", color: "var(--muted)", cursor: "pointer", padding: 2, flex: "0 0 auto" }}
        >
          <MeetingIcon name="x" size={15} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingLeft: 36, marginTop: 10, flexWrap: "wrap" }}>
        {dec.linkedActionId ? (
          <Link
            href={`/actions/${dec.linkedActionId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", background: "var(--ypp-purple-50)", border: "1px solid var(--ypp-purple-200)", borderRadius: 999, padding: "4px 11px", textDecoration: "none" }}
          >
            <MeetingIcon name="link" size={13} />
            Tracked in Action Tracker
            <MeetingIcon name="arrowUpR" size={12} />
          </Link>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MeetingIcon name="alert" size={13} style={{ color: "var(--warn-fg)" }} />
            Decision needs an action
          </span>
        )}
        {!dec.linkedActionId && (
          <MeetingButton size="sm" variant="outline" icon="bolt" disabled={pending} onClick={() => run(() => convertDecisionToAction(dec.id))}>
            Create action
          </MeetingButton>
        )}
      </div>

      {possibleDuplicates.length > 0 && (
        <div style={{ paddingLeft: 36, marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
          Possible existing action{possibleDuplicates.length === 1 ? "" : "s"} from this meeting:{" "}
          {possibleDuplicates.slice(0, 2).map((a, i) => (
            <span key={a.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/actions/${a.id}`} style={{ color: "var(--ypp-purple-700)", fontWeight: 600 }}>
                {a.title}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Follow-ups -------------------------------------------------------------

function FollowUpsSection({ meeting, pending, run, onAdd }: { meeting: MeetingDetailDTO; pending: boolean; run: RunFn; onAdd: () => void }) {
  const overdue = meeting.overdueFollowUps;
  const open = meeting.openFollowUps;
  return (
    <SectionBlock
      title="Follow-ups and actions"
      icon="flag"
      count={open}
      right={
        <MeetingButton size="sm" variant="outline" icon="plus" onClick={onAdd}>
          Add loose end
        </MeetingButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
          Meeting outputs that still need a next step. Create an action when a follow-up needs
          an owner, due date, and accountability.
        </p>
        {overdue > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600, color: "var(--danger-fg)", background: "var(--danger-bg)", border: "1px solid #f3cccc", borderRadius: 10, padding: "9px 13px" }}>
            <MeetingIcon name="alert" size={15} />
            {overdue} follow-up{overdue > 1 ? "s are" : " is"} overdue — create actions so they don&rsquo;t slip.
          </div>
        )}
        {meeting.followUps.length ? (
          meeting.followUps.map((f) => <FollowUpCard key={f.id} f={f} pending={pending} run={run} />)
        ) : (
          <EmptyState
            compact
            icon="flag"
            title="No open follow-ups"
            body="Every meeting output has either been resolved or converted into an action."
          />
        )}
      </div>
    </SectionBlock>
  );
}

function FollowUpCard({ f, pending, run }: { f: FollowUpDTO; pending: boolean; run: RunFn }) {
  const du = dueText(f.dueISO);
  const done = f.effectiveStatus === "completed";
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", background: "var(--surface)", display: "flex", flexDirection: "column", gap: 10, opacity: done ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <button
          onClick={() => run(() => setFollowUpStatus({ id: f.id, status: done ? "OPEN" : "COMPLETED" }))}
          aria-label="Mark complete"
          disabled={pending}
          style={{ width: 22, height: 22, borderRadius: 999, flex: "0 0 auto", marginTop: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${done ? "var(--success-fg)" : "var(--border)"}`, background: done ? "var(--success-fg)" : "var(--surface)", color: "#fff" }}
        >
          {done && <MeetingIcon name="check" size={13} stroke={3} />}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-ink)", lineHeight: 1.35, textDecoration: done ? "line-through" : "none" }}>{f.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {f.owner && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Avatar name={f.owner.name} size={20} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{f.owner.name}</span>
              </span>
            )}
            <FollowUpStatusBadge status={f.effectiveStatus} />
            <CategoryBadge category={f.area} withIcon={false} style={{ fontSize: 11 }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: du.overdue ? "var(--danger-fg)" : "var(--muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <MeetingIcon name="clock" size={12} />
              {du.label}
            </span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingLeft: 33, flexWrap: "wrap" }}>
        {f.linkedActionId ? (
          <Link
            href={`/actions/${f.linkedActionId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: "var(--ypp-purple-700)", background: "var(--ypp-purple-50)", border: "1px solid var(--ypp-purple-200)", borderRadius: 999, padding: "4px 11px", textDecoration: "none" }}
          >
            <MeetingIcon name="link" size={13} />
            Tracked in Action Tracker
            <MeetingIcon name="arrowUpR" size={12} />
          </Link>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MeetingIcon name="alert" size={13} style={{ color: "var(--warn-fg)" }} />
            Follow-up still open — next step: create an action and assign an owner
          </span>
        )}
        <div style={{ display: "flex", gap: 7 }}>
          {!f.linkedActionId && (
            <MeetingButton size="sm" variant="outline" icon="bolt" disabled={pending} onClick={() => run(() => convertFollowUpToAction(f.id))}>
              Create action
            </MeetingButton>
          )}
          {!done && (
            <MeetingButton size="sm" variant="ghost" icon="check" disabled={pending} onClick={() => run(() => setFollowUpStatus({ id: f.id, status: "COMPLETED" }))}>
              Complete
            </MeetingButton>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Linked actions ---------------------------------------------------------

function LinkedActionsSection({ actions }: { actions: LinkedActionDTO[] }) {
  return (
    <SectionBlock
      title="Actions created"
      icon="bolt"
      count={actions.length}
      right={
        <Link href="/actions/all" style={{ textDecoration: "none" }}>
          <MeetingButton size="sm" variant="ghost" iconRight="arrowUpR">
            All actions
          </MeetingButton>
        </Link>
      }
    >
      {actions.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.map((a) => (
            <LinkedAction key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <EmptyState compact icon="bolt" title="No actions created yet" body="Decisions and follow-ups you convert become tracked actions here, linked both ways." />
      )}
    </SectionBlock>
  );
}

function LinkedAction({ a }: { a: LinkedActionDTO }) {
  const du = dueText(a.deadlineISO);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "13px 15px", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ypp-purple-100)", color: "var(--ypp-purple-600)" }}>
        <MeetingIcon name="bolt" size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ypp-ink)" }}>{a.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          {a.owner && <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{a.owner.name}</span>}
          <Pill tone={a.status === "COMPLETE" ? "success" : a.status === "OVERDUE" ? "danger" : "neutral"} style={{ fontSize: 11 }}>
            {a.status.replace(/_/g, " ").toLowerCase()}
          </Pill>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: du.overdue ? "var(--danger-fg)" : "var(--muted)" }}>{du.label}</span>
        </div>
      </div>
      <Link href={`/actions/${a.id}`} style={{ textDecoration: "none" }}>
        <MeetingButton size="sm" variant="outline" iconRight="arrowUpR">
          Open
        </MeetingButton>
      </Link>
    </div>
  );
}

function recurrenceLabel(r: string | null): string {
  if (!r) return "One-time";
  const map: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Bi-weekly", MONTHLY: "Monthly", NONE: "One-time" };
  return map[r] ?? r;
}
