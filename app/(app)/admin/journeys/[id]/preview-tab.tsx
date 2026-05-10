"use client";

import { validateDraft } from "@/lib/journey-editor/validation";
import type {
  BeatDraft,
  GateDraft,
  JourneyAssignmentDraft,
  JourneyDraft,
} from "@/lib/journey-editor/types";

import type { BeatRow } from "./beats-tab";
import type { GateRow } from "./gates-tab";

interface PreviewTabProps {
  journey: { id: string; slug: string; title: string; description: string | null };
  draftVersion: {
    id: string;
    versionNumber: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  } | null;
  beats: BeatRow[];
  gates: GateRow[];
  assignments: Array<{ audience: string; autoEnroll: boolean }>;
  knownModuleContentKeys: string[];
}

export function PreviewTab(props: PreviewTabProps) {
  if (!props.draftVersion) {
    return (
      <div className="card">
        <p className="muted">No draft to preview. Create a draft from the Overview tab.</p>
      </div>
    );
  }

  const draft: JourneyDraft = {
    journeyId: props.journey.id,
    versionId: props.draftVersion.id,
    versionNumber: props.draftVersion.versionNumber,
    status: props.draftVersion.status,
    meta: {
      slug: props.journey.slug,
      title: props.journey.title,
      description: props.journey.description,
      estimatedMinutes: 0,
      passScorePct: 80,
      strictMode: false,
      moduleId: null,
    },
    beats: props.beats.map<BeatDraft>((b) => ({
      id: b.id,
      sourceKey: b.sourceKey,
      kind: b.kind,
      title: b.title,
      prompt: b.prompt,
      mediaUrl: null,
      sortOrder: b.sortOrder,
      parentBeatId: null,
      showWhen: null,
      scoringWeight: b.scoringWeight,
      scoringRule: null,
      schemaVersion: 1,
      removedAt: null,
      config: b.config,
    })),
    gates: props.gates.map<GateDraft>((g) => ({
      id: g.id,
      kind: g.kind,
      targetRef: g.targetRef,
      requiredRef: g.requiredRef,
      threshold: g.threshold,
    })),
    assignments: props.assignments.map<JourneyAssignmentDraft>((a) => ({
      audience: a.audience as JourneyAssignmentDraft["audience"],
      autoEnroll: a.autoEnroll,
    })),
  };

  const draftValidation = validateDraft(draft, {
    knownModuleContentKeys: props.knownModuleContentKeys,
  });
  const publishValidation = validateDraft(draft, {
    knownModuleContentKeys: props.knownModuleContentKeys,
    forPublish: true,
  });

  return (
    <div className="grid-2col">
      <div className="card">
        <h2>Validation</h2>
        <ValidationBlock title="Draft" result={draftValidation} />
        <ValidationBlock title="Publish" result={publishValidation} />
      </div>

      <div className="card">
        <h2>Outline</h2>
        <ol className="preview-outline">
          {props.beats.map((b) => (
            <li key={b.id}>
              <span className="beat-kind-pill">{b.kind}</span>
              <strong>{b.title}</strong>
              <p className="muted">{b.prompt}</p>
              <small className="muted">
                <code>{b.sourceKey}</code> · weight {b.scoringWeight}
              </small>
            </li>
          ))}
        </ol>

        {props.gates.length > 0 ? (
          <>
            <h3>Gates</h3>
            <ul className="preview-gates">
              {props.gates.map((g) => (
                <li key={g.id}>
                  <code>{g.kind}</code> {g.targetRef} ← {g.requiredRef}
                  {g.threshold !== null ? ` ≥ ${g.threshold}%` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ValidationBlock(props: {
  title: string;
  result: { ok: boolean; errors: { scope: string; refId: string | null; field: string | null; message: string }[] };
}) {
  if (props.result.ok) {
    return (
      <div className="validation-block validation-ok">
        <strong>{props.title}: OK</strong>
      </div>
    );
  }
  return (
    <div className="validation-block validation-fail">
      <strong>
        {props.title}: {props.result.errors.length} issue
        {props.result.errors.length === 1 ? "" : "s"}
      </strong>
      <ul>
        {props.result.errors.map((e, i) => (
          <li key={i}>
            <code>{e.scope}{e.field ? `.${e.field}` : ""}</code>
            {e.refId ? ` [${e.refId}]` : ""}: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
