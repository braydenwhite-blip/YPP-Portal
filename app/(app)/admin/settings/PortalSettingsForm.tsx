"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants, CardV2, BannerV2 } from "@/components/ui-v2";
import { updatePortalSettings } from "@/lib/portal-settings/actions";
import type { PortalSettings } from "@/lib/portal-settings/defaults";

type GroupKey = keyof PortalSettings;

type NumberField = {
  group: GroupKey;
  key: string;
  label: string;
  hint?: string;
  step?: string;
};

const GROUPS: Array<{ key: GroupKey; title: string; description: string; fields: NumberField[] }> = [
  {
    key: "chapterOs",
    title: "Chapter Operating System",
    description: "Thresholds and limits powering the Chapter President pipeline Deliberables.",
    fields: [
      { group: "chapterOs", key: "deliberableRowCap", label: "Deliberable row cap", hint: "Max rows shown per pipeline table" },
      { group: "chapterOs", key: "partnerFollowUpOverdueStuckDays", label: "Partner follow-up overdue → Stuck (days)" },
      { group: "chapterOs", key: "partnerSinceContactStuckDays", label: "No partner contact → Stuck (days)" },
      { group: "chapterOs", key: "instructorDecisionSlaHours", label: "Interview decision SLA (hours)" },
      { group: "chapterOs", key: "instructorTriageStaleDays", label: "Applicant triage stale → At risk (days)" },
    ],
  },
  {
    key: "classFeedback",
    title: "Class Feedback",
    description: "What counts as 'good feedback' for a class.",
    fields: [
      { group: "classFeedback", key: "goodFeedbackMinRating", label: "Good feedback minimum rating", hint: "0–5", step: "0.1" },
      { group: "classFeedback", key: "goodFeedbackMinResponses", label: "Good feedback minimum responses" },
    ],
  },
  {
    key: "instructorMentorship",
    title: "Instructor Mentorship",
    description: "When a mentorship session is considered stale.",
    fields: [{ group: "instructorMentorship", key: "staleSessionDays", label: "Mentorship session stale after (days)" }],
  },
];

function fieldId(f: NumberField): string {
  return `${f.group}.${f.key}`;
}

export default function PortalSettingsForm({ initial }: { initial: PortalSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  // Flat string map keyed by "group.key" so every input is a controlled string.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const group of GROUPS) {
      const groupValues = initial[group.key] as Record<string, number>;
      for (const f of group.fields) {
        out[fieldId(f)] = String(groupValues[f.key]);
      }
    }
    return out;
  });

  function setField(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setStatus(null);
  }

  function handleSave() {
    // Build the patch from the edited numeric fields. Status orderings are not
    // exposed in this form; they keep falling back to their defaults.
    const patch: Record<string, Record<string, number>> = {};
    for (const group of GROUPS) {
      const groupPatch: Record<string, number> = {};
      for (const f of group.fields) {
        groupPatch[f.key] = Number(values[fieldId(f)]);
      }
      patch[group.key] = groupPatch;
    }

    startTransition(async () => {
      const result = await updatePortalSettings(patch);
      if (!result.ok) {
        setStatus({ tone: "danger", text: result.error });
        return;
      }
      setStatus({ tone: "success", text: "Settings saved. Changes are live across the portal." });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {status ? (
        <BannerV2 tone={status.tone} title={status.tone === "success" ? "Saved" : "Could not save"}>
          {status.text}
        </BannerV2>
      ) : null}

      {GROUPS.map((group) => (
        <CardV2 key={group.key} as="section">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">{group.title}</p>
          <p className="mt-1 text-[13px] text-ink-muted">{group.description}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) => (
              <label key={fieldId(f)} className="block text-[12.5px] font-semibold text-ink">
                {f.label}
                <input
                  type="number"
                  inputMode="decimal"
                  step={f.step ?? "1"}
                  min={0}
                  value={values[fieldId(f)] ?? ""}
                  onChange={(e) => setField(fieldId(f), e.target.value)}
                  className="mt-1 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
                />
                {f.hint ? <span className="mt-1 block text-[11.5px] font-normal text-ink-muted">{f.hint}</span> : null}
              </label>
            ))}
          </div>
        </CardV2>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span className="text-[12.5px] text-ink-muted">
          Unset or default values fall back to the system defaults automatically.
        </span>
      </div>
    </div>
  );
}
