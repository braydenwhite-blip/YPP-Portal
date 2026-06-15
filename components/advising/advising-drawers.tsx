"use client";

// Advising workflow drawers — polished ModalV2 flows wired to the real
// server actions in lib/leadership/advisor-actions.ts. One drawer component
// switches on the requested workflow so the cockpit only tracks a single
// "active request".

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ModalV2, ModalFooterV2, Button, StatusBadge, cn } from "@/components/ui-v2";
import {
  addAdvisingNote,
  addAdvisingRecommendation,
  assignStudentAdvisor,
  reassignStudentAdvisor,
  setFollowUpFlag,
  updateRecommendationStatus,
} from "@/lib/leadership/advisor-actions";
import {
  RECOMMENDATION_KINDS,
  RECOMMENDATION_KIND_LABELS,
  type RecommendationKind,
} from "@/lib/leadership/constants";
import type { AdvisingCard } from "@/lib/advising/types";
import type { AdvisorPickOption } from "@/lib/advising/queries";

export type AdvisingDrawerKind =
  | "assign"
  | "reassign"
  | "checkin"
  | "kickoff"
  | "followup"
  | "recommendation";

export type AdvisingDrawerRequest = { kind: AdvisingDrawerKind; card: AdvisingCard };

const inputClass =
  "w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";
const labelClass = "text-[12.5px] font-semibold text-ink";

function bandLabel(band: AdvisorPickOption["band"]): string {
  return band === "HIGH" ? "at capacity" : band === "LOW" ? "light caseload" : "has room";
}

function AdvisorSelect({
  value,
  onChange,
  advisors,
  excludeId,
  placeholder = "Select advisor…",
}: {
  value: string;
  onChange: (id: string) => void;
  advisors: AdvisorPickOption[];
  excludeId?: string | null;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      aria-label="Advisor"
    >
      <option value="">{placeholder}</option>
      {advisors
        .filter((a) => a.id !== excludeId)
        .map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} — {a.activeCount} student{a.activeCount === 1 ? "" : "s"} ({bandLabel(a.band)})
            {a.chapterName ? ` · ${a.chapterName}` : ""}
          </option>
        ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function AdvisingDrawer({
  request,
  advisorPool,
  onClose,
}: {
  request: AdvisingDrawerRequest | null;
  advisorPool: AdvisorPickOption[];
  onClose: () => void;
}) {
  return (
    <ModalV2
      open={request !== null}
      onClose={onClose}
      labelledBy="advising-drawer-title"
      accent="brand"
    >
      {request ? (
        <DrawerBody
          key={`${request.kind}:${request.card.id}`}
          request={request}
          advisorPool={advisorPool}
          onClose={onClose}
        />
      ) : (
        <span />
      )}
    </ModalV2>
  );
}

function DrawerBody({
  request,
  advisorPool,
  onClose,
}: {
  request: AdvisingDrawerRequest;
  advisorPool: AdvisorPickOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { card, kind } = request;

  // Shared local state across the various forms.
  const [advisorId, setAdvisorId] = useState(card.suggestion?.advisorId ?? "");
  const [body, setBody] = useState("");
  const [noteKind, setNoteKind] = useState<"CHECK_IN" | "NOTE">("CHECK_IN");
  const [followUpNote, setFollowUpNote] = useState("");
  const [recKind, setRecKind] = useState<RecommendationKind>("CLASS");
  const [recTitle, setRecTitle] = useState("");
  const [recDetail, setRecDetail] = useState("");

  function run(fn: () => Promise<unknown>, validate?: () => string | null) {
    const msg = validate?.();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        onClose();
      } catch {
        setError("Something went wrong. Check the inputs and try again.");
      }
    });
  }

  const heading = (() => {
    switch (kind) {
      case "assign":
        return card.suggestion ? "Review suggested match" : "Assign advisor";
      case "reassign":
        return "Reassign advisor";
      case "checkin":
        return "Add check-in";
      case "kickoff":
        return "Schedule kickoff";
      case "followup":
        return "Create follow-up";
      case "recommendation":
        return card.recommendationId ? "Review recommendation" : "Recommend next step";
    }
  })();

  const subjectName = card.studentName ?? card.title;

  return (
    <div className="grid gap-4">
      <div>
        <h2 id="advising-drawer-title" className="font-sans text-[18px] font-bold text-ink">
          {heading}
        </h2>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {subjectName}
          {card.advisorName && kind !== "assign" ? ` · advisor ${card.advisorName}` : ""}
        </p>
      </div>

      {/* WHY context strip so the decision has its reason in view. */}
      <div className="rounded-[8px] bg-surface-soft px-3 py-2 text-[12.5px] text-ink">
        {card.why}
      </div>

      {/* ── ASSIGN / REVIEW SUGGESTION ─────────────────────────────────── */}
      {(kind === "assign") && (
        <>
          {card.suggestion && (
            <div className="rounded-[10px] border border-brand-200 bg-brand-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-ink">
                  Suggested: {card.suggestion.advisorName}
                </span>
                <StatusBadge tone="brand">{card.suggestion.band === "LOW" ? "Light load" : card.suggestion.band === "HIGH" ? "At capacity" : "Has room"}</StatusBadge>
              </div>
              <ul className="mt-1.5 list-disc pl-4 text-[12px] text-ink-muted">
                {card.suggestion.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {card.suggestion.warnings.map((w) => (
                  <li key={w} className="text-warning-700">{w}</li>
                ))}
              </ul>
            </div>
          )}
          <Field label="Advisor">
            <AdvisorSelect value={advisorId} onChange={setAdvisorId} advisors={advisorPool} />
          </Field>
        </>
      )}

      {/* ── REASSIGN ───────────────────────────────────────────────────── */}
      {kind === "reassign" && (
        <Field label="New advisor">
          <AdvisorSelect
            value={advisorId}
            onChange={setAdvisorId}
            advisors={advisorPool}
            excludeId={card.advisorId}
            placeholder="Move to…"
          />
        </Field>
      )}

      {/* ── CHECK-IN / KICKOFF ─────────────────────────────────────────── */}
      {(kind === "checkin" || kind === "kickoff") && (
        <>
          <div className="flex gap-2">
            {(["CHECK_IN", "NOTE"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setNoteKind(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold",
                  noteKind === k ? "bg-brand-600 text-white" : "bg-surface-soft text-ink-muted",
                )}
              >
                {k === "CHECK_IN" ? "Check-in" : "Note"}
              </button>
            ))}
          </div>
          <Field label={kind === "kickoff" ? "How did the kickoff go?" : "What happened?"}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder={
                kind === "kickoff"
                  ? "Goals discussed, what the student is excited about, the plan…"
                  : "Progress, blockers, what's next…"
              }
            />
          </Field>
          {noteKind === "CHECK_IN" && (
            <p className="text-[12px] text-ink-muted">
              Logging a check-in updates the last-contact date and schedules the next one.
            </p>
          )}
        </>
      )}

      {/* ── FOLLOW-UP ──────────────────────────────────────────────────── */}
      {kind === "followup" && (
        <Field label="Why does this student need follow-up?">
          <input
            value={followUpNote}
            onChange={(e) => setFollowUpNote(e.target.value)}
            className={inputClass}
            placeholder="e.g. Hasn't responded in two weeks; check on project progress"
          />
        </Field>
      )}

      {/* ── RECOMMENDATION ─────────────────────────────────────────────── */}
      {kind === "recommendation" && card.recommendationId && (
        <div className="rounded-[10px] border border-line-soft bg-surface p-3">
          <p className="text-[14px] font-bold text-ink">{card.title}</p>
          {card.context ? <p className="mt-1 text-[12.5px] text-ink-muted">{card.context}</p> : null}
          <p className="mt-2 text-[12px] text-ink-muted">Mark where this recommendation stands:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => run(() => updateRecommendationStatus(card.recommendationId!, "IN_PROGRESS"))}
            >
              In progress
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={isPending}
              onClick={() => run(() => updateRecommendationStatus(card.recommendationId!, "DONE"))}
            >
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => run(() => updateRecommendationStatus(card.recommendationId!, "DISMISSED"))}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {kind === "recommendation" && !card.recommendationId && (
        <>
          <Field label="Type">
            <select
              value={recKind}
              onChange={(e) => setRecKind(e.target.value as RecommendationKind)}
              className={inputClass}
            >
              {RECOMMENDATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {RECOMMENDATION_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Recommendation">
            <input
              value={recTitle}
              onChange={(e) => setRecTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Join Robotics 201, Apply for the instructor pathway"
            />
          </Field>
          <Field label="Why (optional)">
            <textarea
              value={recDetail}
              onChange={(e) => setRecDetail(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
        </>
      )}

      {error ? <p className="text-[12.5px] text-danger-700">{error}</p> : null}

      {/* Footer actions — recommendation-review supplies its own buttons. */}
      {!(kind === "recommendation" && card.recommendationId) && (
        <ModalFooterV2>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {kind === "assign" && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                run(
                  () => assignStudentAdvisor({ advisorId, studentIds: [card.studentId!] }),
                  () => (advisorId ? null : "Pick an advisor first."),
                )
              }
            >
              {isPending ? "Assigning…" : "Assign advisor"}
            </Button>
          )}
          {kind === "reassign" && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                run(
                  () => reassignStudentAdvisor({ assignmentId: card.assignmentId!, newAdvisorId: advisorId }),
                  () => (advisorId ? null : "Pick a new advisor first."),
                )
              }
            >
              {isPending ? "Reassigning…" : "Reassign"}
            </Button>
          )}
          {(kind === "checkin" || kind === "kickoff") && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                run(
                  () => addAdvisingNote({ assignmentId: card.assignmentId!, kind: noteKind, body }),
                  () => (body.trim() ? null : "Add a few words first."),
                )
              }
            >
              {isPending ? "Saving…" : kind === "kickoff" ? "Log kickoff" : "Log check-in"}
            </Button>
          )}
          {kind === "followup" && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  setFollowUpFlag({
                    assignmentId: card.assignmentId!,
                    needsFollowUp: true,
                    followUpNote: followUpNote.trim() || undefined,
                  }),
                )
              }
            >
              {isPending ? "Flagging…" : "Flag for follow-up"}
            </Button>
          )}
          {kind === "recommendation" && !card.recommendationId && (
            <Button
              variant="primary"
              disabled={isPending}
              onClick={() =>
                run(
                  () =>
                    addAdvisingRecommendation({
                      assignmentId: card.assignmentId!,
                      kind: recKind,
                      title: recTitle,
                      detail: recDetail.trim() || undefined,
                    }),
                  () => (recTitle.trim() ? null : "Add a recommendation first."),
                )
              }
            >
              {isPending ? "Saving…" : "Recommend"}
            </Button>
          )}
        </ModalFooterV2>
      )}
    </div>
  );
}
