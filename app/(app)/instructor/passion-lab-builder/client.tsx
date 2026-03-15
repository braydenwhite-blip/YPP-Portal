"use client";

import { useState, useTransition } from "react";
import {
  createPassionLab,
  updatePassionLab,
  updatePassionLabOffering,
  publishPassionLab,
} from "@/lib/passion-lab-actions";
import { RichTextEditor } from "@/components/rich-text-editor";
import { CohortManager } from "@/components/cohort-manager";
import {
  type PassionLabBlueprint,
  type PassionLabSessionTopic,
  emptyPassionLabBlueprint,
  emptyPassionLabSessionTopic,
} from "@/lib/instructor-builder-blueprints";
import { FieldLabel } from "@/components/field-help";
import { passionLabHelp } from "@/data/instructor-guide-content";

type PassionArea = { id: string; name: string; category: string };

type ExistingLab = {
  id: string;
  name: string;
  submissionStatus: string;
  isActive: boolean;
  startDate: Date | null;
  _count: { participants: number };
};

type ReadinessSummary = {
  canPublishFirstOffering: boolean;
  nextAction: {
    title: string;
    detail: string;
    href: string;
  };
};

type EditData = {
  id: string;
  name: string;
  description: string;
  interestArea: string;
  drivingQuestion: string | null;
  targetAgeGroup: string;
  difficulty: string;
  deliveryMode: string;
  finalShowcase: string | null;
  submissionFormat: string;
  maxParticipants: number;
  labBlueprint: PassionLabBlueprint;
  sessionTopics: PassionLabSessionTopic[];
  startDate: string;
  endDate: string;
  submissionStatus: string;
};

type Props = {
  existingLabs: ExistingLab[];
  passionAreas: PassionArea[];
  chapterId: string | null;
  readiness: ReadinessSummary;
  editData?: EditData | null;
};

type Step = "core" | "sessions" | "offering" | "done";

const DIFFICULTY_OPTIONS = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

const DELIVERY_MODES = [
  { value: "VIRTUAL", label: "Virtual" },
  { value: "IN_PERSON", label: "In-Person" },
  { value: "HYBRID", label: "Hybrid" },
];

const AGE_GROUPS = ["8-10", "10-12", "12-14", "14-16", "16-18", "18+", "Mixed"];

export function PassionLabBuilderClient({
  existingLabs,
  passionAreas,
  chapterId,
  readiness,
  editData,
}: Props) {
  const isEditMode = !!editData;
  const [step, setStep] = useState<Step>(isEditMode ? "core" : "core");
  const [savedProgramId, setSavedProgramId] = useState<string | null>(editData?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Core form state — pre-populate from editData if available
  const [name, setName] = useState(editData?.name ?? "");
  const [interestArea, setInterestArea] = useState(editData?.interestArea ?? "");
  const [drivingQuestion, setDrivingQuestion] = useState<string | null>(editData?.drivingQuestion ?? null);
  const [targetAgeGroup, setTargetAgeGroup] = useState(editData?.targetAgeGroup ?? "");
  const [difficulty, setDifficulty] = useState(editData?.difficulty ?? "BEGINNER");
  const [deliveryMode, setDeliveryMode] = useState(editData?.deliveryMode ?? "VIRTUAL");
  const [finalShowcase, setFinalShowcase] = useState<string | null>(editData?.finalShowcase ?? null);
  const [submissionFormat, setSubmissionFormat] = useState(editData?.submissionFormat ?? "");
  const [description, setDescription] = useState(editData?.description ?? "");
  const [labBlueprint, setLabBlueprint] = useState<PassionLabBlueprint>(
    editData?.labBlueprint ?? emptyPassionLabBlueprint()
  );

  // Session topics
  const [sessionTopics, setSessionTopics] = useState<PassionLabSessionTopic[]>(
    editData?.sessionTopics && editData.sessionTopics.length > 0
      ? editData.sessionTopics
      : [emptyPassionLabSessionTopic()]
  );

  // Offering setup
  const [startDate, setStartDate] = useState(editData?.startDate ?? "");
  const [endDate, setEndDate] = useState(editData?.endDate ?? "");
  const [maxParticipants, setMaxParticipants] = useState(editData?.maxParticipants ?? 25);
  const [locationName, setLocationName] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const publishBlocked = !readiness.canPublishFirstOffering;

  function addSessionRow() {
    setSessionTopics((prev) => [...prev, emptyPassionLabSessionTopic()]);
  }

  function updateSessionRow(index: number, field: keyof PassionLabSessionTopic, value: string) {
    setSessionTopics((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function updateBlueprint(field: keyof PassionLabBlueprint, value: string) {
    setLabBlueprint((prev) => ({ ...prev, [field]: value }));
  }

  function removeSessionRow(index: number) {
    setSessionTopics((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveCore() {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    if (!interestArea) { setError("Passion area is required"); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("description", description);
        fd.set("interestArea", interestArea);
        fd.set("drivingQuestion", drivingQuestion ?? "");
        fd.set("targetAgeGroup", targetAgeGroup);
        fd.set("difficulty", difficulty);
        fd.set("deliveryMode", deliveryMode);
        fd.set("finalShowcase", finalShowcase ?? "");
        fd.set("submissionFormat", submissionFormat);
        fd.set("maxParticipants", String(maxParticipants));
        fd.set("labBlueprint", JSON.stringify(labBlueprint));
        if (chapterId) fd.set("chapterId", chapterId);
        fd.set("sessionTopics", JSON.stringify(sessionTopics));

        if (!savedProgramId) {
          const res = await createPassionLab(fd);
          setSavedProgramId(res.programId);
        } else {
          await updatePassionLab(savedProgramId, fd);
        }

        setStep("sessions");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  async function handleSaveSessions() {
    setError(null);
    if (!savedProgramId) { setError("Please save the core info first"); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("name", name);
        fd.set("interestArea", interestArea);
        fd.set("labBlueprint", JSON.stringify(labBlueprint));
        fd.set("sessionTopics", JSON.stringify(sessionTopics));
        await updatePassionLab(savedProgramId, fd);
        setStep("offering");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save sessions");
      }
    });
  }

  async function handleSaveOffering() {
    setError(null);
    if (!savedProgramId) return;
    if (!startDate || !endDate) { setError("Start and end dates are required"); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("startDate", startDate);
        fd.set("endDate", endDate);
        fd.set("maxParticipants", String(maxParticipants));
        fd.set("deliveryMode", deliveryMode);
        if (locationName) fd.set("locationName", locationName);
        if (zoomLink) fd.set("zoomLink", zoomLink);
        await updatePassionLabOffering(savedProgramId, fd);
        setStep("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save offering details");
      }
    });
  }

  async function handlePublish() {
    if (!savedProgramId) return;
    startTransition(async () => {
      try {
        await publishPassionLab(savedProgramId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to publish");
      }
    });
  }

  const stepLabels: Record<Step, string> = {
    core: "1. Core Info",
    sessions: "2. Session Plan",
    offering: "3. Offering Setup",
    done: "4. Enroll Students",
  };

  return (
    <div style={{ padding: "24px", maxWidth: 860 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              {isEditMode ? `Edit: ${editData?.name}` : "Passion Lab Builder"}
            </h1>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              {isEditMode
                ? "Edit this passion lab's details, sessions, and offering settings."
                : "Create a structured, passion-driven lab experience for students."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="/instructor/guide?tab=passion-labs"
              className="button outline small"
              style={{ textDecoration: "none", fontSize: 12 }}
            >
              View Guide
            </a>
            {isEditMode && (
              <a
                href="/instructor/passion-lab-builder"
                className="button outline small"
                style={{ textDecoration: "none", fontSize: 12 }}
              >
                + New Lab
              </a>
            )}
          </div>
        </div>
        {isEditMode && editData?.submissionStatus && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 12px",
              display: "inline-block",
              borderRadius: "var(--radius-full)",
              fontSize: 12,
              fontWeight: 600,
              background:
                editData.submissionStatus === "APPROVED"
                  ? "#dcfce7"
                  : editData.submissionStatus === "NEEDS_REVISION"
                  ? "#fee2e2"
                  : editData.submissionStatus === "SUBMITTED"
                  ? "#dbeafe"
                  : "var(--surface-alt)",
              color:
                editData.submissionStatus === "APPROVED"
                  ? "#166534"
                  : editData.submissionStatus === "NEEDS_REVISION"
                  ? "#991b1b"
                  : editData.submissionStatus === "SUBMITTED"
                  ? "#1e40af"
                  : "var(--muted)",
            }}
          >
            Status: {editData.submissionStatus.replace(/_/g, " ")}
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["core", "sessions", "offering", "done"] as Step[]).map((s) => (
          <div
            key={s}
            style={{
              padding: "4px 12px",
              borderRadius: "var(--radius-full)",
              fontSize: 12,
              fontWeight: 600,
              background: s === step ? "var(--ypp-purple)" : "var(--surface-alt)",
              color: s === step ? "#fff" : "var(--muted)",
              cursor: s !== step && savedProgramId ? "pointer" : "default",
            }}
            onClick={() => {
              if (savedProgramId && s !== step) setStep(s);
            }}
          >
            {stepLabels[s]}
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fff3e0",
            border: "1px solid #ffb74d",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "#e65100",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}
      {!readiness.canPublishFirstOffering && (
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

      {/* ─── Step 1: Core Info ─────────────────────────────────── */}
      {step === "core" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Core Info</h2>

          <div className="form-grid">
            <div className="form-row">
              <FieldLabel label="Lab Name" required help={passionLabHelp.name} />
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Urban Photography Lab"
              />
            </div>

            <div className="form-row">
              <FieldLabel label="Passion Area" required help={passionLabHelp.interestArea} />
              <select className="input" value={interestArea} onChange={(e) => setInterestArea(e.target.value)}>
                <option value="">Select area…</option>
                {passionAreas.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <FieldLabel label="Driving Question" help={passionLabHelp.drivingQuestion} />
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              The central inquiry students will explore throughout the lab.
            </p>
            <RichTextEditor
              value={drivingQuestion}
              onChange={setDrivingQuestion}
              placeholder="What drives this lab's inquiry?"
              minHeight={80}
            />
          </div>

          <div className="form-grid">
            <div className="form-row">
              <FieldLabel label="Target Age Group" help={passionLabHelp.targetAgeGroup} />
              <select className="input" value={targetAgeGroup} onChange={(e) => setTargetAgeGroup(e.target.value)}>
                <option value="">Select…</option>
                {AGE_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="form-row">
              <FieldLabel label="Difficulty" help={passionLabHelp.difficulty} />
              <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {DIFFICULTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <FieldLabel label="Delivery Mode" help={passionLabHelp.deliveryMode} />
            <div style={{ display: "flex", gap: 8 }}>
              {DELIVERY_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`button ${deliveryMode === m.value ? "primary" : "outline"} small`}
                  onClick={() => setDeliveryMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-row">
            <FieldLabel label="Final Showcase / Outcome" help={passionLabHelp.finalShowcase} />
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 6px" }}>
              What will students create, present, or demonstrate by the end?
            </p>
            <RichTextEditor
              value={finalShowcase}
              onChange={setFinalShowcase}
              placeholder="Describe the final showcase or culminating project…"
              minHeight={80}
            />
          </div>

          <div className="form-row">
            <FieldLabel label="Submission Format" help={passionLabHelp.submissionFormat} />
            <input
              className="input"
              value={submissionFormat}
              onChange={(e) => setSubmissionFormat(e.target.value)}
              placeholder="e.g. Digital portfolio, live demo, written report"
            />
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <strong style={{ display: "block", marginBottom: 4 }}>Lab Blueprint</strong>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
                Add the bigger plan that makes this lab feel thoughtful, supported, and showcase-ready.
              </p>
            </div>
            {([
              ["bigIdea", "Big Idea", "What larger idea are students exploring through this lab?"],
              ["studentChoicePlan", "Student Choice Plan", "Where will students make decisions, personalize, or lead?"],
              ["mentorCommunityConnection", "Mentor / Community Connection", "What real-world person, partner, or audience will connect to this lab?"],
              ["showcaseCriteria", "Showcase Criteria", "What does a strong final showcase look like?"],
              ["supportPlan", "Support Plan", "How will you support students when they get stuck?"],
              ["riskSafetyNotes", "Risk / Safety Notes", "Any safety, access, or risk notes to plan around?"],
              ["resourcePlan", "Resource Plan", "What materials, spaces, or digital tools will the lab need?"],
            ] as const).map(([field, label, placeholder]) => (
              <div className="form-row" key={field}>
                <FieldLabel label={label} help={passionLabHelp[field]} />
                <textarea
                  className="input"
                  rows={2}
                  value={labBlueprint[field]}
                  onChange={(e) => updateBlueprint(field, e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              className="button primary"
              onClick={handleSaveCore}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save & Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Session Plan ──────────────────────────────── */}
      {step === "sessions" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Session Plan</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Add one row per session. You can also add or edit sessions after publishing.
          </p>

          {sessionTopics.map((s, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>Session {idx + 1}</strong>
                {sessionTopics.length > 1 && (
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => removeSessionRow(idx)}
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="form-row">
                <label>Topic</label>
                <input
                  className="input"
                  value={s.topic}
                  onChange={(e) => updateSessionRow(idx, "topic", e.target.value)}
                  placeholder="What will students explore this session?"
                />
              </div>

              <div className="form-grid">
                <div className="form-row">
                  <label>Objective</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.objective}
                    onChange={(e) => updateSessionRow(idx, "objective", e.target.value)}
                    placeholder="What should students learn or be able to do in this session?"
                  />
                </div>
                <div className="form-row">
                  <label>Checkpoint / Artifact</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.checkpointArtifact}
                    onChange={(e) => updateSessionRow(idx, "checkpointArtifact", e.target.value)}
                    placeholder="What visible checkpoint or artifact should students leave with?"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-row">
                  <label>Mini-Lesson</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.miniLesson}
                    onChange={(e) => updateSessionRow(idx, "miniLesson", e.target.value)}
                    placeholder="What concept or technique will you teach directly?"
                  />
                </div>
                <div className="form-row">
                  <label>Hands-On Build</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.handsOnBuild}
                    onChange={(e) => updateSessionRow(idx, "handsOnBuild", e.target.value)}
                    placeholder="What will students actively build, create, or test?"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-row">
                  <label>Collaboration</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.collaboration}
                    onChange={(e) => updateSessionRow(idx, "collaboration", e.target.value)}
                    placeholder="How will students work with, critique, or support each other?"
                  />
                </div>
                <div className="form-row">
                  <label>Reflection</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.reflection}
                    onChange={(e) => updateSessionRow(idx, "reflection", e.target.value)}
                    placeholder="How will students pause and reflect on what happened?"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-row">
                  <label>Materials / Tools</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.materialsTools}
                    onChange={(e) => updateSessionRow(idx, "materialsTools", e.target.value)}
                    placeholder="What materials, tools, software, or resources will be used?"
                  />
                </div>
                <div className="form-row">
                  <label>Progress Evidence</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={s.progressEvidence}
                    onChange={(e) => updateSessionRow(idx, "progressEvidence", e.target.value)}
                    placeholder="How will you know students made progress in this session?"
                  />
                </div>
              </div>

              <div className="form-row">
                <label>Extension Prompt</label>
                <textarea
                  className="input"
                  rows={2}
                  value={s.extensionPrompt}
                  onChange={(e) => updateSessionRow(idx, "extensionPrompt", e.target.value)}
                  placeholder="Optional extension, take-home prompt, or next step…"
                />
              </div>
            </div>
          ))}

          <button type="button" className="button outline small" onClick={addSessionRow}>
            + Add Session
          </button>

          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="button outline small" onClick={() => setStep("core")}>
              ← Back
            </button>
            <button
              type="button"
              className="button primary"
              onClick={handleSaveSessions}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save & Continue →"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Offering Setup ────────────────────────────── */}
      {step === "offering" && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Offering Setup</h2>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Set dates and logistics. Students will see this when enrolling.
          </p>

          <div className="form-grid">
            <div className="form-row">
              <label>Start Date *</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>End Date *</label>
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <label>Max Participants</label>
            <input
              className="input"
              type="number"
              min={1}
              max={200}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 25)}
            />
          </div>

          {deliveryMode !== "VIRTUAL" && (
            <div className="form-row">
              <label>Location</label>
              <input
                className="input"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Location name or address"
              />
            </div>
          )}

          {deliveryMode !== "IN_PERSON" && (
            <div className="form-row">
              <label>Zoom / Meeting Link</label>
              <input
                className="input"
                type="url"
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="button outline small" onClick={() => setStep("sessions")}>
              ← Back
            </button>
            <button
              type="button"
              className="button primary"
              onClick={handleSaveOffering}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save & Prepare Publish →"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 4: Done / Enroll ────────────────────────────── */}
      {step === "done" && savedProgramId && (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              padding: "14px 20px",
              background: "#e8f5e9",
              border: "1px solid #a5d6a7",
              borderRadius: "var(--radius-md)",
            }}
          >
            <strong style={{ fontSize: 14 }}>Lab created and ready to publish!</strong>
            <p style={{ fontSize: 13, margin: "4px 0 0", color: "#2e7d32" }}>
              Publish to make it visible to students, then enroll your cohorts.
            </p>
          </div>
          {!readiness.canPublishFirstOffering && (
            <div
              style={{
                padding: "12px 16px",
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                borderRadius: "var(--radius-md)",
                color: "#92400e",
                fontSize: 13,
              }}
            >
              <strong style={{ display: "block", marginBottom: 4 }}>
                You can keep this lab as a draft, but you cannot publish it yet.
              </strong>
              <span>{readiness.nextAction.detail}</span>
            </div>
          )}

          <button
            type="button"
            className="button primary"
            onClick={handlePublish}
            disabled={isPending || publishBlocked}
            title={publishBlocked ? readiness.nextAction.detail : undefined}
          >
            {isPending ? "Publishing…" : "Publish Passion Lab"}
          </button>

          {chapterId && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Enroll Students</h3>
              <CohortManager programId={savedProgramId} chapterId={chapterId} />
            </div>
          )}
        </div>
      )}

      {/* ─── Existing Labs sidebar list ───────────────────────── */}
      {existingLabs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Your Passion Labs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {existingLabs.map((lab) => (
              <div
                key={lab.id}
                className="card"
                style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>{lab.name}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {lab._count.participants} enrolled · {lab.isActive ? "Published" : lab.submissionStatus}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a
                    href={`/instructor/passion-lab-builder?id=${lab.id}`}
                    className="button outline small"
                    style={{ textDecoration: "none" }}
                  >
                    Edit
                  </a>
                  <a
                    href={`/programs/${lab.id}`}
                    className="button outline small"
                    style={{ textDecoration: "none" }}
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
