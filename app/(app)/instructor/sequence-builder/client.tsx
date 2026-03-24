"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createSequence,
  updateSequence,
  addSequenceStep,
  deleteSequenceStep,
  reorderSequenceStep,
  setStepUnlockType,
  publishSequence,
  deleteSequence,
} from "@/lib/sequence-actions";
import {
  type SequenceBlueprint,
  type SequenceStepDetails,
  emptySequenceBlueprint,
  emptySequenceStepDetails,
} from "@/lib/instructor-builder-blueprints";
import { FieldLabel } from "@/components/field-help";
import { sequenceHelp } from "@/data/instructor-guide-content";

type ClassTemplate = {
  id: string;
  title: string;
  interestArea: string;
  difficultyLevel: string;
};

type PassionLab = {
  id: string;
  name: string;
  isActive: boolean;
};

type Step = {
  id: string;
  stepOrder: number;
  unlockType: "AUTO" | "MANUAL";
  title: string | null;
  classTemplateId: string | null;
  specialProgramId: string | null;
  stepDetails?: SequenceStepDetails | null;
  classTemplate?: { id: string; title: string } | null;
  specialProgram?: { id: string; name: string; type: string } | null;
};

type Sequence = {
  id: string;
  name: string;
  description: string;
  interestArea: string;
  isActive: boolean;
  sequenceBlueprint?: SequenceBlueprint | null;
  steps: Step[];
};

type ReadinessSummary = {
  baseReadinessComplete: boolean;
  nextAction: {
    title: string;
    detail: string;
    href: string;
  };
};

type Props = {
  sequences: Sequence[];
  approvedTemplates: ClassTemplate[];
  passionLabs: PassionLab[];
  readiness: ReadinessSummary;
  initialActiveSequenceId?: string | null;
};

type AddStepTab = "class" | "passion-lab" | "standalone";

export function SequenceBuilderClient({
  sequences,
  approvedTemplates,
  passionLabs,
  readiness,
  initialActiveSequenceId,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sequence list state
  const [localSequences, setLocalSequences] = useState<Sequence[]>(sequences);

  // Active sequence being edited — prefer initialActiveSequenceId if provided
  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(
    initialActiveSequenceId ?? sequences[0]?.id ?? null
  );

  // New sequence form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newInterestArea, setNewInterestArea] = useState("");
  const [newSequenceBlueprint, setNewSequenceBlueprint] = useState<SequenceBlueprint>(
    emptySequenceBlueprint()
  );

  // Add step panel
  const [addStepTab, setAddStepTab] = useState<AddStepTab>("class");
  const [standaloneTitle, setStandaloneTitle] = useState("");
  const [sequenceBlueprint, setSequenceBlueprint] = useState<SequenceBlueprint>(
    emptySequenceBlueprint()
  );
  const [stepDetails, setStepDetails] = useState<SequenceStepDetails>(
    emptySequenceStepDetails()
  );

  const activeSequence = localSequences.find((s) => s.id === activeSequenceId) ?? null;
  const publishBlocked = !readiness.baseReadinessComplete;

  useEffect(() => {
    if (!activeSequence) {
      setSequenceBlueprint(emptySequenceBlueprint());
      return;
    }
    setSequenceBlueprint(activeSequence.sequenceBlueprint ?? emptySequenceBlueprint());
  }, [activeSequence]);

  async function handleCreateSequence() {
    if (!newName.trim()) { setError("Name is required"); return; }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", newName);
        fd.set("description", newDescription);
        fd.set("interestArea", newInterestArea || "General");
        fd.set("sequenceBlueprint", JSON.stringify(newSequenceBlueprint));
        const res = await createSequence(fd);
        const newSeq: Sequence = {
          id: res.sequenceId,
          name: newName,
          description: newDescription,
          interestArea: newInterestArea || "General",
          isActive: false,
          sequenceBlueprint: newSequenceBlueprint,
          steps: [],
        };
        setLocalSequences((prev) => [newSeq, ...prev]);
        setActiveSequenceId(res.sequenceId);
        setShowNewForm(false);
        setNewName("");
        setNewDescription("");
        setNewInterestArea("");
        setNewSequenceBlueprint(emptySequenceBlueprint());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create sequence");
      }
    });
  }

  async function handleSaveOverview() {
    if (!activeSequence) return;
    setError(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", activeSequence.name);
        fd.set("description", activeSequence.description);
        fd.set("interestArea", activeSequence.interestArea || "General");
        fd.set("sequenceBlueprint", JSON.stringify(sequenceBlueprint));
        await updateSequence(activeSequence.id, fd);
        setLocalSequences((prev) =>
          prev.map((sequence) =>
            sequence.id === activeSequence.id
              ? { ...sequence, sequenceBlueprint: { ...sequenceBlueprint } }
              : sequence
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save sequence overview");
      }
    });
  }

  async function handleAddStep(
    type: "class" | "passion-lab" | "standalone",
    contentId?: string,
    label?: string
  ) {
    if (!activeSequenceId) return;
    setError(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        if (type === "class" && contentId) {
          fd.set("classTemplateId", contentId);
        } else if (type === "passion-lab" && contentId) {
          fd.set("specialProgramId", contentId);
        } else if (type === "standalone") {
          if (!standaloneTitle.trim()) { setError("Enter a title for the step"); return; }
          fd.set("title", standaloneTitle);
        }
        fd.set("stepDetails", JSON.stringify(stepDetails));

        const res = await addSequenceStep(activeSequenceId, fd);

        const newStep: Step = {
          id: res.stepId,
          stepOrder: activeSequence ? activeSequence.steps.length : 0,
          unlockType: "AUTO",
          title: type === "standalone" ? standaloneTitle : null,
          classTemplateId: type === "class" ? contentId ?? null : null,
          specialProgramId: type === "passion-lab" ? contentId ?? null : null,
          stepDetails: { ...stepDetails },
          classTemplate: type === "class" ? { id: contentId!, title: label! } : null,
          specialProgram:
            type === "passion-lab"
              ? { id: contentId!, name: label!, type: "PASSION_LAB" }
              : null,
        };

        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? { ...s, steps: [...s.steps, newStep] }
              : s
          )
        );

        if (type === "standalone") setStandaloneTitle("");
        setStepDetails(emptySequenceStepDetails());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add step");
      }
    });
  }

  async function handleDeleteStep(stepId: string) {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await deleteSequenceStep(stepId);
        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? { ...s, steps: s.steps.filter((st) => st.id !== stepId).map((st, i) => ({ ...st, stepOrder: i })) }
              : s
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete step");
      }
    });
  }

  async function handleReorder(stepId: string, direction: "up" | "down") {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await reorderSequenceStep(stepId, direction);
        setLocalSequences((prev) =>
          prev.map((s) => {
            if (s.id !== activeSequenceId) return s;
            const steps = [...s.steps];
            const idx = steps.findIndex((st) => st.id === stepId);
            const swapIdx = direction === "up" ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= steps.length) return s;
            [steps[idx], steps[swapIdx]] = [steps[swapIdx], steps[idx]];
            return { ...s, steps: steps.map((st, i) => ({ ...st, stepOrder: i })) };
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reorder");
      }
    });
  }

  async function handleToggleUnlock(stepId: string, current: "AUTO" | "MANUAL") {
    const next: "AUTO" | "MANUAL" = current === "AUTO" ? "MANUAL" : "AUTO";
    startTransition(async () => {
      try {
        await setStepUnlockType(stepId, next);
        setLocalSequences((prev) =>
          prev.map((s) =>
            s.id === activeSequenceId
              ? {
                  ...s,
                  steps: s.steps.map((st) =>
                    st.id === stepId ? { ...st, unlockType: next } : st
                  ),
                }
              : s
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update unlock type");
      }
    });
  }

  async function handlePublish() {
    if (!activeSequenceId) return;
    startTransition(async () => {
      try {
        await publishSequence(activeSequenceId);
        setLocalSequences((prev) =>
          prev.map((s) => (s.id === activeSequenceId ? { ...s, isActive: true } : s))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  function updateSequenceField(
    field: "name" | "description" | "interestArea",
    value: string
  ) {
    if (!activeSequenceId) return;
    setLocalSequences((prev) =>
      prev.map((sequence) =>
        sequence.id === activeSequenceId ? { ...sequence, [field]: value } : sequence
      )
    );
  }

  function updateSequenceBlueprintField(field: keyof SequenceBlueprint, value: string) {
    setSequenceBlueprint((prev) => ({ ...prev, [field]: value }));
  }

  function updateNewSequenceBlueprintField(
    field: keyof SequenceBlueprint,
    value: string
  ) {
    setNewSequenceBlueprint((prev) => ({ ...prev, [field]: value }));
  }

  function updateStepDetailsField(field: keyof SequenceStepDetails, value: string) {
    setStepDetails((prev) => ({ ...prev, [field]: value }));
  }

  async function handleDeleteSequence(id: string) {
    if (!confirm("Delete this sequence? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteSequence(id);
        setLocalSequences((prev) => prev.filter((s) => s.id !== id));
        if (activeSequenceId === id) {
          setActiveSequenceId(localSequences.find((s) => s.id !== id)?.id ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  function getStepLabel(step: Step): string {
    if (step.classTemplate) return `📚 ${step.classTemplate.title}`;
    if (step.specialProgram) return `🔬 ${step.specialProgram.name}`;
    if (step.title) return `📝 ${step.title}`;
    return "Unnamed step";
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Sequence Builder</h1>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              Build ordered learning sequences from classes, passion labs, and standalone milestones.
            </p>
          </div>
          <a
            href="/instructor/guide?tab=sequences"
            className="button outline small"
            style={{ textDecoration: "none" }}
          >
            View Guide
          </a>
        </div>
      </div>
      {!readiness.baseReadinessComplete && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "#92400e",
            marginBottom: 16,
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>
            Drafts are open. Publishing is still locked.
          </strong>
          <span>{readiness.nextAction.detail}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24 }}>
        {/* ── Left: Sequence list ─────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14 }}>My Sequences</strong>
            <button
              type="button"
              className="button outline small"
              onClick={() => {
                setShowNewForm((value) => {
                  const next = !value;
                  if (next) {
                    setNewName("");
                    setNewDescription("");
                    setNewInterestArea("");
                    setNewSequenceBlueprint(emptySequenceBlueprint());
                  }
                  return next;
                });
              }}
            >
              {showNewForm ? "Cancel" : "+ New"}
            </button>
          </div>

          {showNewForm && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sequence name" />
              <input className="input" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description (optional)" />
              <input className="input" value={newInterestArea} onChange={(e) => setNewInterestArea(e.target.value)} placeholder="Interest area (optional)" />
              <textarea
                className="input"
                rows={2}
                value={newSequenceBlueprint.endGoalCapstone}
                onChange={(e) => updateNewSequenceBlueprintField("endGoalCapstone", e.target.value)}
                placeholder="Optional: what is the capstone or end goal?"
              />
              <button type="button" className="button primary small" onClick={handleCreateSequence} disabled={isPending}>
                Create
              </button>
            </div>
          )}

          {localSequences.length === 0 && !showNewForm && (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>No sequences yet.</p>
          )}

          {localSequences.map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSequenceId(s.id)}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: s.id === activeSequenceId ? "var(--ypp-purple-50, #f3f0ff)" : "transparent",
                border: s.id === activeSequenceId ? "1px solid var(--ypp-purple-200, #c4b5fd)" : "1px solid transparent",
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {s.steps.length} step{s.steps.length !== 1 ? "s" : ""} · {s.isActive ? "Published" : "Draft"}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: Sequence editor ──────────────────────────────────── */}
        <div>
          {!activeSequence ? (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
              Select or create a sequence to start building.
            </div>
          ) : (
            <>
              {error && (
                <div style={{ padding: "10px 14px", background: "#fff3e0", border: "1px solid #ffb74d", borderRadius: "var(--radius-md)", fontSize: 13, color: "#e65100", marginBottom: 14 }}>
                  {error}
                </div>
              )}

              {/* Sequence header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{activeSequence.name}</h2>
                  {activeSequence.description && (
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{activeSequence.description}</p>
                  )}
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>
                    {activeSequence.interestArea || "General"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!activeSequence.isActive && (
                    <button
                      type="button"
                      className="button primary small"
                      onClick={handlePublish}
                      disabled={isPending || activeSequence.steps.length === 0 || publishBlocked}
                      title={publishBlocked ? readiness.nextAction.detail : undefined}
                    >
                      Publish Sequence
                    </button>
                  )}
                  {activeSequence.isActive && (
                    <span style={{ padding: "4px 12px", borderRadius: "var(--radius-full)", background: "#e8f5e9", color: "#2e7d32", fontSize: 12, fontWeight: 600 }}>
                      ✓ Published
                    </span>
                  )}
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => handleDeleteSequence(activeSequence.id)}
                    disabled={isPending}
                    style={{ color: "var(--muted)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Sequence Overview</strong>
                  <button type="button" className="button outline small" onClick={handleSaveOverview} disabled={isPending}>
                    Save Overview
                  </button>
                </div>
                <div className="form-grid">
                  <div className="form-row">
                    <label>Name</label>
                    <input
                      className="input"
                      value={activeSequence.name}
                      onChange={(e) => updateSequenceField("name", e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label>Interest Area</label>
                    <input
                      className="input"
                      value={activeSequence.interestArea}
                      onChange={(e) => updateSequenceField("interestArea", e.target.value)}
                      placeholder="General"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label>Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={activeSequence.description}
                    onChange={(e) => updateSequenceField("description", e.target.value)}
                    placeholder="Short description for instructors and students"
                  />
                </div>
                {([
                  ["targetLearner", "Target Learner", "Who is this sequence designed for?"],
                  ["entryPoint", "Entry Point", "What should students know, bring, or start with?"],
                  ["endGoalCapstone", "End Goal / Capstone", "What is the final outcome or capstone at the end of the sequence?"],
                  ["pacingGuidance", "Pacing Guidance", "How fast should students move through the sequence?"],
                  ["supportCheckpoints", "Support Checkpoints", "Where should instructors pause for check-ins or support?"],
                  ["completionSignals", "Completion Signals", "What evidence shows a student is truly ready to move on?"],
                ] as const).map(([field, label, placeholder]) => (
                  <div className="form-row" key={field}>
                    <FieldLabel label={label} help={sequenceHelp[field]} />
                    <textarea
                      className="input"
                      rows={2}
                      value={sequenceBlueprint[field]}
                      onChange={(e) => updateSequenceBlueprintField(field, e.target.value)}
                      placeholder={placeholder}
                    />
                  </div>
                ))}
              </div>

              {/* Step list */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "0 0 10px" }}>STEPS</h3>

                  {activeSequence.steps.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>No steps yet. Add a step from the panel on the right.</p>
                  )}

                  {activeSequence.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        marginBottom: 8,
                        background: "var(--surface)",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", minWidth: 20 }}>
                        {idx + 1}.
                      </span>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{getStepLabel(step)}</div>
                        {step.stepDetails && (
                          <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)" }}>
                            {step.stepDetails.purpose || "Purpose not set"}
                            {step.stepDetails.estimatedDuration ? ` · ${step.stepDetails.estimatedDuration}` : ""}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleUnlock(step.id, step.unlockType)}
                          disabled={isPending}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "var(--radius-full)",
                            border: "none",
                            cursor: "pointer",
                            marginTop: 4,
                            background: step.unlockType === "MANUAL" ? "#fff3e0" : "#e8f5e9",
                            color: step.unlockType === "MANUAL" ? "#e65100" : "#2e7d32",
                          }}
                        >
                          {step.unlockType === "AUTO" ? "AUTO unlock" : "MANUAL unlock"}
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="button ghost small" onClick={() => handleReorder(step.id, "up")} disabled={idx === 0 || isPending} style={{ padding: "4px 6px" }}>↑</button>
                        <button type="button" className="button ghost small" onClick={() => handleReorder(step.id, "down")} disabled={idx === activeSequence.steps.length - 1 || isPending} style={{ padding: "4px 6px" }}>↓</button>
                        <button type="button" className="button danger small" onClick={() => handleDeleteStep(step.id)} disabled={isPending} style={{ padding: "4px 8px" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add step panel */}
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "0 0 10px" }}>ADD STEP</h3>
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                    {/* Tabs */}
                    <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                      {(["class", "passion-lab", "standalone"] as AddStepTab[]).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setAddStepTab(tab)}
                          style={{
                            flex: 1,
                            padding: "8px 4px",
                            fontSize: 11,
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer",
                            borderBottom: addStepTab === tab ? "2px solid var(--ypp-purple)" : "2px solid transparent",
                            background: addStepTab === tab ? "var(--ypp-purple-50, #f3f0ff)" : "transparent",
                            color: addStepTab === tab ? "var(--ypp-purple)" : "var(--muted)",
                          }}
                        >
                          {tab === "class" ? "Class" : tab === "passion-lab" ? "Passion Lab" : "Standalone"}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: 12 }}>
                      {addStepTab === "class" && (
                        <div>
                          {approvedTemplates.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted)" }}>No approved class templates. Submit a curriculum for review first.</p>
                          ) : (
                            approvedTemplates.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                className="button outline small"
                                onClick={() => handleAddStep("class", t.id, t.title)}
                                disabled={isPending}
                                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, fontSize: 12 }}
                              >
                                <strong>{t.title}</strong>
                                <span style={{ color: "var(--muted)", marginLeft: 4 }}>{t.interestArea}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {addStepTab === "passion-lab" && (
                        <div>
                          {passionLabs.length === 0 ? (
                            <p style={{ fontSize: 12, color: "var(--muted)" }}>No passion labs found. Create one in the Passion Lab Builder first.</p>
                          ) : (
                            passionLabs.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="button outline small"
                                onClick={() => handleAddStep("passion-lab", p.id, p.name)}
                                disabled={isPending}
                                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, fontSize: 12 }}
                              >
                                <strong>{p.name}</strong>
                                {!p.isActive && <span style={{ color: "var(--muted)", marginLeft: 4 }}>(draft)</span>}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {addStepTab === "standalone" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            className="input"
                            value={standaloneTitle}
                            onChange={(e) => setStandaloneTitle(e.target.value)}
                            placeholder="Step title (e.g. Portfolio Review)"
                          />
                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => handleAddStep("standalone")}
                            disabled={isPending || !standaloneTitle.trim()}
                          >
                            Add Step
                          </button>
                        </div>
                      )}

                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                        <strong style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Step Details</strong>
                        {([
                          ["purpose", "Purpose", "Why is this step in the sequence?"],
                          ["expectedEvidence", "Expected Evidence", "What should students produce or demonstrate here?"],
                          ["estimatedDuration", "Estimated Duration", "e.g. 1 week, 2 sessions, 90 minutes"],
                          ["coachSupportNote", "Coach / Support Note", "What support should instructors or mentors give here?"],
                          ["unlockRationale", "Unlock Rationale", "Why should this step unlock when it does?"],
                        ] as const).map(([field, label, placeholder]) => (
                          <div key={field} style={{ marginBottom: 8 }}>
                            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                              {label}
                            </label>
                            <textarea
                              className="input"
                              rows={2}
                              value={stepDetails[field]}
                              onChange={(e) => updateStepDetailsField(field, e.target.value)}
                              placeholder={placeholder}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
