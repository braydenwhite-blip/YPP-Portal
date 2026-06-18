"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CcIcon } from "@/components/command-center/icons";
import { Button, ButtonLink, cn } from "@/components/ui-v2";
import { FeedbackBanner } from "@/components/people-strategy/motion";
import { createPartner } from "@/lib/partners-actions";
import {
  PARTNER_PRIORITIES,
  PARTNER_PRIORITY_LABELS,
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
} from "@/lib/partners-constants";

export type PartnerLeadOption = { id: string; name: string };

const inputClass =
  "w-full rounded-[12px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px] text-ink shadow-sm transition-colors placeholder:text-ink-muted/70 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";
const titleInputClass = cn(inputClass, "py-3.5 text-[16px] font-medium tracking-[-0.01em]");
const selectClass = inputClass;

function FormSection({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">{title}</h2>
          {hint ? <p className="m-0 mt-0.5 text-[13px] leading-relaxed text-ink-muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Calm OS add-partner form — used on `/partners/new`. */
export function PartnerCreateForm({
  leads,
  currentUserId,
  cancelHref = "/partners",
  pipelineEnabled = false,
}: {
  leads: PartnerLeadOption[];
  currentUserId: string;
  cancelHref?: string;
  pipelineEnabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);

  const pipeline = pipelineEnabled;
  const defaultLead =
    leads.some((l) => l.id === currentUserId) ? currentUserId : leads[0]?.id ?? "";

  const [name, setName] = useState("");
  const [relationshipLeadId, setRelationshipLeadId] = useState(defaultLead);
  const [partnerType, setPartnerType] = useState("");
  const [stage, setStage] = useState("NOT_STARTED");
  const [priority, setPriority] = useState("MEDIUM");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Organization name is required.");
      return;
    }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", trimmed);
        if (relationshipLeadId) fd.set("relationshipLeadId", relationshipLeadId);
        if (pipeline && partnerType) fd.set("partnerType", partnerType);
        if (!pipeline && partnerType.trim()) fd.set("type", partnerType.trim());
        if (pipeline) fd.set("stage", stage);
        if (pipeline) fd.set("priority", priority);
        if (website.trim()) fd.set("website", website.trim());
        if (notes.trim()) fd.set("notes", notes.trim());

        const result = await createPartner(fd);
        router.push(`/admin/partners/${result.id}#relationship-ops`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add partner. Try again.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-[20px] border border-line-soft bg-gradient-to-br from-brand-50/40 via-surface to-surface shadow-card"
    >
      <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-7">
        {error ? <FeedbackBanner tone="error" message={error} /> : null}

        <FormSection step={1} title="Who is the partner?" hint="School, nonprofit, camp, or organization name.">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lincoln High School"
            className={titleInputClass}
            maxLength={160}
            required
            autoFocus
            aria-label="Partner name"
          />
        </FormSection>

        <div className="h-px bg-line-soft/80" aria-hidden />

        <FormSection step={2} title="Who owns the relationship?" hint="The officer responsible for follow-up.">
          <select
            value={relationshipLeadId}
            onChange={(e) => setRelationshipLeadId(e.target.value)}
            className={selectClass}
            aria-label="Relationship lead"
          >
            <option value="">— No lead yet —</option>
            {leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.name}
              </option>
            ))}
          </select>
        </FormSection>

        <div className="h-px bg-line-soft/80" aria-hidden />

        <FormSection step={3} title="Anything else?" hint="Optional — expand if you know type or website.">
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="text-[13px] font-semibold text-brand-700 hover:text-brand-800"
          >
            {showExtras ? "Hide optional fields" : "Add type, stage, website…"}
          </button>
          {showExtras ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {pipeline ? (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    Type
                    <select
                      value={partnerType}
                      onChange={(e) => setPartnerType(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">— Select —</option>
                      {PARTNER_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {PARTNER_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    Stage
                    <select value={stage} onChange={(e) => setStage(e.target.value)} className={selectClass}>
                      {PARTNER_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {PARTNER_STAGE_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    Priority
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={selectClass}
                    >
                      {PARTNER_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {PARTNER_PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink sm:col-span-2">
                  Type
                  <input
                    type="text"
                    value={partnerType}
                    onChange={(e) => setPartnerType(e.target.value)}
                    placeholder="School, nonprofit, corporate…"
                    className={inputClass}
                    maxLength={80}
                    name="type"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink sm:col-span-2">
                Website
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink sm:col-span-2">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={inputClass}
                  placeholder="Context, contacts, or next step…"
                />
              </label>
            </div>
          ) : null}
        </FormSection>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-surface/90 px-5 py-4 sm:px-7">
        <p className="m-0 text-[12.5px] text-ink-muted">Under a minute — you can add contacts after saving.</p>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={cancelHref} variant="ghost" size="md">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" size="md" disabled={pending}>
            {pending ? "Saving…" : "Add partner"}
          </Button>
        </div>
      </footer>
    </form>
  );
}
