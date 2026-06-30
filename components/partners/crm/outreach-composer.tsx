"use client";

/**
 * Outreach email composer (Partner Automation, Phase 1).
 *
 * Generates a copy-ready email deterministically (no AI, no sending). The CP
 * picks the email type, copies it into their own mail client, then marks it
 * sent — which advances the partner and auto-schedules the follow-up.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ModalV2, ModalFooterV2, ToastV2, cn } from "@/components/ui-v2";
import {
  generateOutreachEmail,
  renderEmailForClipboard,
  OUTREACH_EMAIL_KINDS,
  OUTREACH_EMAIL_KIND_LABELS,
  type OutreachEmailContext,
  type OutreachEmailKind,
} from "@/lib/partners/outreach-email";
import { markEmailSent } from "@/lib/partners/crm-actions";

export function OutreachComposer({
  partnerId,
  context,
  defaultKind = "INITIAL",
  buttonVariant = "secondary",
  buttonLabel,
}: {
  partnerId: string;
  context: OutreachEmailContext;
  defaultKind?: OutreachEmailKind;
  buttonVariant?: "primary" | "secondary" | "ghost";
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OutreachEmailKind>(defaultKind);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const email = useMemo(() => generateOutreachEmail(kind, context), [kind, context]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(renderEmailForClipboard(email));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ tone: "danger", msg: "Couldn't copy — select the text manually." });
    }
  }

  function markSent() {
    startTransition(async () => {
      try {
        const res = await markEmailSent({ partnerId, followUp: kind !== "INITIAL" });
        if (!res.ok) {
          setToast({ tone: "danger", msg: res.error });
          return;
        }
        setToast({ tone: "success", msg: "Email marked sent ✓" });
        setOpen(false);
        router.refresh();
      } catch {
        setToast({ tone: "danger", msg: "Something went wrong." });
      }
    });
  }

  return (
    <>
      <Button variant={buttonVariant} size="sm" onClick={() => setOpen(true)}>
        {buttonLabel ?? "Generate email"}
      </Button>
      <ModalV2 open={open} onClose={() => setOpen(false)} size="lg" accent="brand" labelledBy="composer-title">
        <h2 id="composer-title" className="m-0 text-[18px] font-bold text-ink">
          Outreach email
        </h2>
        <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
          Copy this into your email, then mark it sent — we&rsquo;ll schedule the follow-up for you. Nothing is sent automatically.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {OUTREACH_EMAIL_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
                kind === k
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-line-soft text-ink-muted hover:text-ink"
              )}
            >
              {OUTREACH_EMAIL_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-[12px] border border-line-card bg-surface-2 p-3">
          <p className="m-0 text-[12px] font-bold text-ink">Subject: {email.subject}</p>
          <textarea
            readOnly
            value={email.body}
            rows={14}
            className="mt-2 w-full resize-y rounded-[8px] border border-line-soft bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed text-ink"
            aria-label="Generated email body"
          />
        </div>

        <ModalFooterV2>
          <Button variant="ghost" size="md" onClick={() => setOpen(false)}>Close</Button>
          <Button variant="secondary" size="md" onClick={copy}>{copied ? "Copied ✓" : "Copy email"}</Button>
          <Button variant="primary" size="md" loading={pending} onClick={markSent}>Mark email sent</Button>
        </ModalFooterV2>
      </ModalV2>
      {toast && (
        <ToastV2 open tone={toast.tone}>
          {toast.msg}
        </ToastV2>
      )}
    </>
  );
}
