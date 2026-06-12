"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  Button,
  ModalFooterV2,
  ModalV2,
  StatusBadge,
  cn,
} from "@/components/ui-v2";
import { buildFeedbackRequestEmailContent } from "@/lib/people-strategy/feedback-email-content";
import {
  prepareMonthlyFeedbackPlan,
  sendPlannedFeedbackRequests,
  type MonthlyFeedbackPlan,
  type SendPlannedFeedbackResult,
} from "@/lib/people-strategy/feedback-plan-actions";
import type { SuggestedFeedbackCollaborator } from "@/lib/people-strategy/feedback-plan";

/**
 * Request Monthly Feedback — the reviewable workflow (ui-v2).
 *
 * Flow: open → the plan loads (member, target months, suggested collaborators
 * with reasons + shared work, who was already asked) → Leadership reviews and
 * unchecks anyone who shouldn't be asked → optional email preview (built by
 * the SAME pure builder the sender uses) → send → honest result summary
 * (created vs already-requested vs email failures are separate numbers).
 *
 * Nothing is sent until the send button is pressed, and the server action
 * re-derives every recipient's reasons from live data — the client only ever
 * submits ids.
 */

type DrawerPhase = "loading" | "review" | "sending" | "done" | "error";

const CONTEXT_TYPE_LABELS: Record<string, string> = {
  action: "Action",
  class: "Class",
  mentorship: "Mentorship",
  meeting: "Meeting",
};

function resultSummary(result: SendPlannedFeedbackResult): string[] {
  const lines: string[] = [];
  lines.push(
    result.created === 0
      ? "No new requests were created."
      : `Created ${result.created} feedback request${result.created === 1 ? "" : "s"}.`
  );
  if (result.emailsSent > 0) {
    lines.push(`${result.emailsSent} email${result.emailsSent === 1 ? "" : "s"} sent.`);
  }
  if (result.emailsNotSent > 0) {
    lines.push(
      `${result.emailsNotSent} request${result.emailsNotSent === 1 ? "" : "s"} created without a sent email (no address on file or the send failed) — the recipient can still answer from their portal link.`
    );
  }
  if (result.alreadyRequested > 0) {
    lines.push(
      `${result.alreadyRequested} recipient${result.alreadyRequested === 1 ? " was" : "s were"} already asked for this month — not re-sent.`
    );
  }
  if (result.notSuggested > 0) {
    lines.push(
      `${result.notSuggested} selection${result.notSuggested === 1 ? " is" : "s are"} no longer backed by shared work and ${result.notSuggested === 1 ? "was" : "were"} skipped.`
    );
  }
  return lines;
}

function RecipientRow({
  suggestion,
  checked,
  disabled,
  disabledReason,
  onToggle,
}: {
  suggestion: SuggestedFeedbackCollaborator;
  checked: boolean;
  disabled: boolean;
  disabledReason: string | null;
  onToggle: () => void;
}) {
  const inputId = `fb-recipient-${suggestion.id}`;
  return (
    <li
      className={cn(
        "flex gap-3 rounded-[8px] border border-line-soft px-3 py-2.5",
        checked && "border-brand-300 bg-brand-50/50",
        disabled && "opacity-60"
      )}
    >
      <input
        id={inputId}
        type="checkbox"
        className="mt-1 size-4 shrink-0 accent-brand-600"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
      />
      <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13.5px] font-semibold text-ink">
            {suggestion.name || suggestion.email || "Unnamed member"}
          </span>
          {suggestion.title || suggestion.role ? (
            <span className="text-[12px] text-ink-muted">
              {suggestion.title ?? suggestion.role}
            </span>
          ) : null}
          {!suggestion.email ? (
            <StatusBadge tone="warning">No email on file</StatusBadge>
          ) : null}
          {disabledReason ? (
            <StatusBadge tone="info" title={disabledReason}>
              Already asked
            </StatusBadge>
          ) : null}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-muted">
          {suggestion.reasons.join(" · ")}
        </span>
        {suggestion.contextItems.length > 0 ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {suggestion.contextItems.map((item) => (
              <span
                key={`${item.type}-${item.id}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-ink-muted ring-1 ring-line-soft"
                title={item.detail ? `${item.title} — ${item.detail}` : item.title}
              >
                <span className="font-semibold text-brand-700">
                  {CONTEXT_TYPE_LABELS[item.type] ?? item.type}
                </span>
                <span className="truncate">{item.title}</span>
              </span>
            ))}
          </span>
        ) : null}
      </label>
    </li>
  );
}

export function FeedbackRequestDrawer({
  member,
  onClose,
}: {
  /** The member feedback is being requested about; null = drawer closed. */
  member: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<DrawerPhase>("loading");
  const [plan, setPlan] = useState<MonthlyFeedbackPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [result, setResult] = useState<SendPlannedFeedbackResult | null>(null);
  const [, startTransition] = useTransition();

  const open = member !== null;
  const memberId = member?.id ?? null;

  // Load the plan whenever a member is picked.
  useEffect(() => {
    if (!memberId) return;
    setPhase("loading");
    setPlan(null);
    setError(null);
    setResult(null);
    setPreviewOpen(false);
    startTransition(async () => {
      try {
        const loaded = await prepareMonthlyFeedbackPlan({ subjectUserId: memberId });
        setPlan(loaded);
        setMonthKey(loaded.defaultMonthKey);
        const alreadyAsked = new Set(
          loaded.alreadyRequestedByMonth[loaded.defaultMonthKey] ?? []
        );
        setSelected(
          new Set(
            loaded.suggestions
              .filter((s) => s.defaultSelected && !alreadyAsked.has(s.id))
              .map((s) => s.id)
          )
        );
        setPhase("review");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load suggestions.");
        setPhase("error");
      }
    });
  }, [memberId]);

  const alreadyAskedForMonth = useMemo(
    () => new Set(plan?.alreadyRequestedByMonth[monthKey] ?? []),
    [plan, monthKey]
  );

  const selectedIds = useMemo(
    () => Array.from(selected).filter((id) => !alreadyAskedForMonth.has(id)),
    [selected, alreadyAskedForMonth]
  );

  const monthLabel =
    plan?.months.find((m) => m.key === monthKey)?.label ?? monthKey;

  const previewRecipient = useMemo(() => {
    if (!plan) return null;
    return plan.suggestions.find((s) => selectedIds.includes(s.id)) ?? null;
  }, [plan, selectedIds]);

  const previewContent = useMemo(() => {
    if (!plan || !previewRecipient) return null;
    return buildFeedbackRequestEmailContent({
      recipientName: previewRecipient.name,
      subjectName: plan.subject.name || plan.subject.email || "this member",
      monthLabel,
      dueDateLabel: plan.dueDateLabel,
      workItems: previewRecipient.contextItems.map((item) =>
        item.detail ? `${item.title} — ${item.detail}` : item.title
      ),
    });
  }, [plan, previewRecipient, monthLabel]);

  function toggleRecipient(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSend() {
    if (!memberId || selectedIds.length === 0) return;
    setPhase("sending");
    setError(null);
    startTransition(async () => {
      try {
        const sent = await sendPlannedFeedbackRequests({
          subjectUserId: memberId,
          monthKey,
          collaboratorIds: selectedIds,
        });
        setResult(sent);
        setPhase("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send the requests.");
        setPhase("review");
      }
    });
  }

  const sending = phase === "sending";

  return (
    <ModalV2
      open={open}
      onClose={onClose}
      locked={sending}
      labelledBy="feedback-request-title"
      size="lg"
      accent="brand"
      motionKey="feedback-request"
    >
      <header className="flex flex-col gap-1">
        <p className="m-0 text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
          Request monthly feedback
        </p>
        <h2 id="feedback-request-title" className="m-0 text-[19px] font-bold text-ink">
          {member?.name ?? "Member"}
        </h2>
        <p className="m-0 text-[12.5px] text-ink-muted">
          Collaborators below are suggested from shared actions, classes,
          mentorships, and meetings. Responses are confidential — read only by
          Leadership and the Board — and feed the member&apos;s monthly check-in.
        </p>
      </header>

      {phase === "loading" ? (
        <p className="m-0 py-6 text-center text-[13px] text-ink-muted" role="status">
          Finding recent collaborators…
        </p>
      ) : null}

      {phase === "error" ? (
        <p className="m-0 py-4 text-[13px] font-semibold text-danger-700" role="alert">
          {error}
        </p>
      ) : null}

      {phase === "done" && result ? (
        <div className="flex flex-col gap-2 py-2" role="status">
          {resultSummary(result).map((line) => (
            <p key={line} className="m-0 text-[13px] text-ink">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {(phase === "review" || sending) && plan ? (
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[12px] font-semibold text-ink-muted">
              Target month
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                disabled={sending}
                className="rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium text-ink"
              >
                {plan.months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="m-0 text-[12.5px] text-ink-muted">
              Reply requested by <strong className="text-ink">{plan.dueDateLabel}</strong>{" "}
              · ~3–5 minutes per response
            </p>
          </div>

          {plan.suggestions.length === 0 ? (
            <p className="m-0 rounded-[8px] bg-surface-soft px-3 py-4 text-[13px] text-ink-muted">
              No recent collaborators found — no shared action items, classes,
              mentorships, or meetings in the last 120 days. Feedback requests
              need a real working relationship to send to.
            </p>
          ) : (
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-1 p-0 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                Recipients · {selectedIds.length} selected
              </legend>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {plan.suggestions.map((suggestion) => {
                  const alreadyAsked = alreadyAskedForMonth.has(suggestion.id);
                  return (
                    <RecipientRow
                      key={suggestion.id}
                      suggestion={suggestion}
                      checked={selected.has(suggestion.id) && !alreadyAsked}
                      disabled={sending || alreadyAsked}
                      disabledReason={
                        alreadyAsked ? `Already asked for ${monthLabel}` : null
                      }
                      onToggle={() => toggleRecipient(suggestion.id)}
                    />
                  );
                })}
              </ul>
            </fieldset>
          )}

          {previewContent ? (
            <div className="rounded-[8px] border border-line-soft">
              <button
                type="button"
                onClick={() => setPreviewOpen((v) => !v)}
                aria-expanded={previewOpen}
                className="flex w-full items-center justify-between bg-surface-soft px-3 py-2 text-left text-[12.5px] font-semibold text-ink"
              >
                <span>
                  Email preview · to {previewRecipient?.name || previewRecipient?.email}
                </span>
                <span aria-hidden className="text-ink-muted">
                  {previewOpen ? "−" : "+"}
                </span>
              </button>
              {previewOpen ? (
                <div className="flex flex-col gap-2 px-3 py-3 text-[13px] text-ink">
                  <p className="m-0">
                    <span className="font-bold">Subject:</span> {previewContent.subject}
                  </p>
                  <p className="m-0">{previewContent.greeting}</p>
                  {previewContent.intro.map((p) => (
                    <p key={p} className="m-0">
                      {p}
                    </p>
                  ))}
                  {previewContent.workItems.length > 0 ? (
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                      {previewContent.workItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {previewContent.closing.map((p) => (
                    <p key={p} className="m-0 text-[12.5px] text-ink-muted">
                      {p}
                    </p>
                  ))}
                  {selectedIds.length > 1 ? (
                    <p className="m-0 text-[12px] italic text-ink-muted">
                      Each recipient receives their own version listing the work
                      they share with {plan.subject.name?.split(" ")[0] ?? "the member"}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="m-0 text-[13px] font-semibold text-danger-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <ModalFooterV2>
        {phase === "done" ? (
          <Button variant="primary" size="md" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="md" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              disabled={sending || phase !== "review" || selectedIds.length === 0}
            >
              {sending
                ? "Sending…"
                : `Send to ${selectedIds.length} recipient${selectedIds.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </ModalFooterV2>
    </ModalV2>
  );
}
