"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  type WorkshopReflectionPayload,
} from "@/lib/workshop-proposal-constants";
import { reflectionIssues } from "@/lib/workshop-proposal-validation";
import {
  saveReflection,
  submitWorkshopProposal,
} from "@/lib/workshop-proposal-actions";
import type { WorkshopProposalSourceType } from "@prisma/client";

type ReviewSubmitFormProps = {
  sourceType: WorkshopProposalSourceType;
  initialReflection: WorkshopReflectionPayload;
  editable: boolean;
  canSubmit: boolean;
  customIssues: string[];
  reflectionIssues: string[];
  allIssues: string[];
};

const REFLECTION_PROMPTS: {
  key: keyof WorkshopReflectionPayload;
  label: string;
  hint: string;
}[] = [
  {
    key: "whyChosen",
    label: "Why did you choose this workshop?",
    hint:
      "Reviewers want to see your fit. What about this idea makes you the right person to teach it?",
  },
  {
    key: "audienceAdaptation",
    label: "How would you adapt it for your specific audience?",
    hint:
      "Real classrooms aren't the spec. What would you change for the kids you'd actually be teaching?",
  },
  {
    key: "hardestPart",
    label: "What part might be hardest to teach?",
    hint: "Honesty signals craft. Name the part that worries you and how you'd handle it.",
  },
  {
    key: "engagementPlan",
    label: "How would you keep students engaged?",
    hint: "Specific moves beat platitudes. What's your move when energy dips?",
  },
];

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function ReviewSubmitForm({
  initialReflection,
  editable,
  canSubmit,
  customIssues,
  reflectionIssues: reflectionIssuesIn,
  allIssues,
}: ReviewSubmitFormProps) {
  const router = useRouter();
  const [reflection, setReflection] = useState<WorkshopReflectionPayload>(
    initialReflection
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();
  const lastSig = useRef<string>(JSON.stringify(initialReflection));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recompute live issues against the current text.
  const liveReflectionIssues = useMemo(
    () => reflectionIssues(reflection),
    [reflection]
  );
  const liveAllIssues = useMemo(() => {
    if (customIssues.length > 0) return [...customIssues, ...liveReflectionIssues];
    return [...allIssues.filter((i) => !reflectionIssuesIn.includes(i)), ...liveReflectionIssues];
  }, [customIssues, allIssues, reflectionIssuesIn, liveReflectionIssues]);
  const liveCanSubmit = editable && liveAllIssues.length === 0;

  // Autosave the reflection on debounce.
  useEffect(() => {
    if (!editable) return;
    const sig = JSON.stringify(reflection);
    if (sig === lastSig.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("whyChosen", reflection.whyChosen);
      fd.set("audienceAdaptation", reflection.audienceAdaptation);
      fd.set("hardestPart", reflection.hardestPart);
      fd.set("engagementPlan", reflection.engagementPlan);
      startSave(async () => {
        try {
          await saveReflection(fd);
          lastSig.current = sig;
          setSavedAt(new Date());
          setSaveError(null);
        } catch (err) {
          setSaveError(err instanceof Error ? err.message : "Save failed.");
        }
      });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [reflection, editable]);

  function handleSubmit() {
    if (!liveCanSubmit) return;
    setSubmitError(null);
    startSubmit(async () => {
      try {
        // Force a save flush before submitting in case the user clicks fast.
        const fd = new FormData();
        fd.set("whyChosen", reflection.whyChosen);
        fd.set("audienceAdaptation", reflection.audienceAdaptation);
        fd.set("hardestPart", reflection.hardestPart);
        fd.set("engagementPlan", reflection.engagementPlan);
        await saveReflection(fd);
        await submitWorkshopProposal();
        router.push("/instructor/workshop-design-studio?submitted=1");
        router.refresh();
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Could not submit."
        );
      }
    });
  }

  return (
    <section
      className="card"
      style={{ marginBottom: 20, display: "grid", gap: 16 }}
    >
      <div>
        <h3 style={{ marginTop: 0 }}>Reflection</h3>
        <p style={{ marginTop: 0, color: "var(--muted)", fontSize: 14 }}>
          Reviewers read these closely. Specifics, honesty, and a real plan
          land best.
        </p>
      </div>

      {REFLECTION_PROMPTS.map((p) => (
        <label key={p.key} style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.label}</span>
          <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
            {p.hint}
          </span>
          <textarea
            className="input"
            rows={4}
            value={reflection[p.key]}
            disabled={!editable}
            onChange={(e) =>
              setReflection((prev) => ({ ...prev, [p.key]: e.target.value }))
            }
          />
        </label>
      ))}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {!editable
            ? "Locked — submission in review."
            : isSaving
              ? "Saving reflection…"
              : savedAt
                ? `Reflection saved ${savedAt.toLocaleTimeString()}`
                : "Autosaves while you type."}
          {saveError ? (
            <span style={{ color: "#dc2626", marginLeft: 8 }}>
              · {saveError}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          className="button"
          disabled={!liveCanSubmit || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting
            ? "Submitting…"
            : !editable
              ? "Submission locked"
              : liveCanSubmit
                ? "Submit for review"
                : `Resolve ${liveAllIssues.length} item${liveAllIssues.length === 1 ? "" : "s"} to submit`}
        </button>
      </div>

      {submitError ? (
        <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }} role="alert">
          {submitError}
        </p>
      ) : null}

      {!liveCanSubmit && liveAllIssues.length > 0 && editable ? (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 10,
            padding: 12,
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#92400e" }}>
            Before submitting, finish these:
          </p>
          <ul
            style={{
              paddingLeft: 18,
              fontSize: 13,
              color: "#92400e",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {liveAllIssues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
