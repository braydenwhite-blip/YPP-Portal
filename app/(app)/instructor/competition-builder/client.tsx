"use client";

import { useState, useTransition } from "react";
import {
  createCompetitionDraft,
  updateCompetitionDraft,
  deleteCompetitionDraft,
} from "@/lib/competition-draft-actions";
import { RichTextEditor } from "@/components/rich-text-editor";

type PassionArea = { id: string; name: string; category: string };
type ChapterUser = { id: string; name: string; email: string };

type JudgingCriterion = {
  name: string;
  weight: number;
  description: string;
};

type Draft = {
  id: string;
  season: string;
  theme: string;
  status: string;
  createdAt: Date;
};

type Props = {
  existingDrafts: Draft[];
  passionAreas: PassionArea[];
  chapterUsers: ChapterUser[];
};

export function CompetitionBuilderClient({ existingDrafts, passionAreas, chapterUsers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [season, setSeason] = useState("");
  const [theme, setTheme] = useState("");
  const [passionArea, setPassionArea] = useState("");
  const [rules, setRules] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [communityVoteWeight, setCommunityVoteWeight] = useState(0.3);
  const [firstPlaceReward, setFirstPlaceReward] = useState("");
  const [secondPlaceReward, setSecondPlaceReward] = useState("");
  const [thirdPlaceReward, setThirdPlaceReward] = useState("");
  const [judgingCriteria, setJudgingCriteria] = useState<JudgingCriterion[]>([
    { name: "", weight: 1, description: "" },
  ]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);

  function addCriterion() {
    setJudgingCriteria((prev) => [...prev, { name: "", weight: 1, description: "" }]);
  }

  function updateCriterion(idx: number, field: keyof JudgingCriterion, value: string | number) {
    setJudgingCriteria((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  }

  function removeCriterion(idx: number) {
    setJudgingCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleJudge(id: string) {
    setSelectedJudgeIds((prev) =>
      prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id]
    );
  }

  function buildFormData() {
    const fd = new FormData();
    fd.set("season", season);
    fd.set("theme", theme);
    if (passionArea) fd.set("passionArea", passionArea);
    fd.set("rules", rules ?? "");
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    fd.set("submissionDeadline", submissionDeadline);
    fd.set("votingEnabled", String(votingEnabled));
    fd.set("communityVoteWeight", String(communityVoteWeight));
    if (firstPlaceReward) fd.set("firstPlaceReward", firstPlaceReward);
    if (secondPlaceReward) fd.set("secondPlaceReward", secondPlaceReward);
    if (thirdPlaceReward) fd.set("thirdPlaceReward", thirdPlaceReward);
    fd.set(
      "judgingCriteria",
      JSON.stringify(
        judgingCriteria.filter((c) => c.name.trim())
      )
    );
    if (selectedJudgeIds.length > 0) fd.set("judgeIds", selectedJudgeIds.join(","));
    return fd;
  }

  function validate() {
    if (!season.trim()) return "Season is required";
    if (!theme.trim()) return "Theme is required";
    if (!rules) return "Rules are required";
    if (!startDate) return "Start date is required";
    if (!endDate) return "End date is required";
    if (!submissionDeadline) return "Submission deadline is required";
    return null;
  }

  async function handleSaveDraft() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const fd = buildFormData();
        if (!savedId) {
          const res = await createCompetitionDraft(fd);
          setSavedId(res.competitionId);
        } else {
          await updateCompetitionDraft(savedId, fd);
        }
        setSuccessMessage(
          "Draft saved. An admin will review and publish this competition."
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save draft");
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    startTransition(async () => {
      try {
        await deleteCompetitionDraft(id);
        if (savedId === id) setSavedId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete");
      }
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Competition Builder</h1>
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Draft a competition. An admin will review and publish it.
        </p>
      </div>

      {/* Admin review notice */}
      <div
        style={{
          padding: "10px 16px",
          background: "var(--ypp-purple-50, #f3f0ff)",
          border: "1px solid var(--ypp-purple-200, #c4b5fd)",
          borderRadius: "var(--radius-md)",
          fontSize: 13,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>ℹ</span>
        <span>
          Competitions you create are saved as drafts. Once submitted, an admin publishes them and opens submissions.
        </span>
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

      {successMessage && (
        <div
          style={{
            padding: "10px 14px",
            background: "#e8f5e9",
            border: "1px solid #a5d6a7",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "#2e7d32",
            marginBottom: 16,
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Basic Info */}
        <div className="form-grid">
          <div className="form-row">
            <label>Season *</label>
            <input
              className="input"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. Spring 2026"
            />
          </div>
          <div className="form-row">
            <label>Theme *</label>
            <input
              className="input"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Reimagining Public Spaces"
            />
          </div>
        </div>

        <div className="form-row">
          <label>Passion Area</label>
          <select className="input" value={passionArea} onChange={(e) => setPassionArea(e.target.value)}>
            <option value="">All passion areas</option>
            {passionAreas.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="form-row">
            <label>Start Date *</label>
            <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label>End Date *</label>
            <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Submission Deadline *</label>
            <input className="input" type="date" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} />
          </div>
        </div>

        {/* Rules */}
        <div className="form-row">
          <label>Rules *</label>
          <RichTextEditor
            value={rules}
            onChange={setRules}
            placeholder="Enter competition rules, eligibility, submission requirements…"
          />
        </div>

        {/* Judging Criteria */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label>Judging Criteria</label>
            <button type="button" className="button outline small" onClick={addCriterion}>
              + Add Criterion
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 1fr 36px",
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--muted)",
              padding: "0 4px",
              marginBottom: 4,
            }}
          >
            <span>Name</span>
            <span>Weight</span>
            <span>Description</span>
            <span />
          </div>
          {judgingCriteria.map((c, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 1fr 36px",
                gap: 6,
                marginBottom: 6,
                alignItems: "center",
              }}
            >
              <input
                className="input"
                value={c.name}
                onChange={(e) => updateCriterion(idx, "name", e.target.value)}
                placeholder="e.g. Creativity"
              />
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={c.weight}
                onChange={(e) => updateCriterion(idx, "weight", parseFloat(e.target.value) || 0)}
              />
              <input
                className="input"
                value={c.description}
                onChange={(e) => updateCriterion(idx, "description", e.target.value)}
                placeholder="What judges evaluate"
              />
              <button
                type="button"
                className="button danger small"
                onClick={() => removeCriterion(idx)}
                style={{ padding: "6px 8px" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Judges */}
        {chapterUsers.length > 0 && (
          <div className="form-row">
            <label>Judges</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: 8,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {chapterUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`button ${selectedJudgeIds.includes(u.id) ? "primary" : "outline"} small`}
                  onClick={() => toggleJudge(u.id)}
                  style={{ fontSize: 12 }}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voting */}
        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={votingEnabled}
              onChange={(e) => setVotingEnabled(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Enable Community Voting
          </label>
        </div>

        {votingEnabled && (
          <div className="form-row">
            <label>Community Vote Weight: {Math.round(communityVoteWeight * 100)}%</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={communityVoteWeight}
              onChange={(e) => setCommunityVoteWeight(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)" }}>
              <span>0% community</span>
              <span>{Math.round(communityVoteWeight * 100)}% community / {Math.round((1 - communityVoteWeight) * 100)}% judges</span>
              <span>100% community</span>
            </div>
          </div>
        )}

        {/* Rewards */}
        <div>
          <label style={{ marginBottom: 8, display: "block" }}>Rewards</label>
          <div className="form-grid">
            <div className="form-row">
              <label>🥇 First Place</label>
              <input className="input" value={firstPlaceReward} onChange={(e) => setFirstPlaceReward(e.target.value)} placeholder="e.g. $100 gift card" />
            </div>
            <div className="form-row">
              <label>🥈 Second Place</label>
              <input className="input" value={secondPlaceReward} onChange={(e) => setSecondPlaceReward(e.target.value)} placeholder="e.g. $50 gift card" />
            </div>
            <div className="form-row">
              <label>🥉 Third Place</label>
              <input className="input" value={thirdPlaceReward} onChange={(e) => setThirdPlaceReward(e.target.value)} placeholder="e.g. $25 gift card" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ paddingTop: 8 }}>
          <button
            type="button"
            className="button primary"
            onClick={handleSaveDraft}
            disabled={isPending}
          >
            {isPending ? "Saving…" : savedId ? "Update Draft" : "Save Draft"}
          </button>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Drafts are visible only to you and admins. An admin will publish when ready.
          </p>
        </div>
      </div>

      {/* Existing Drafts */}
      {existingDrafts.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Your Competition Drafts</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {existingDrafts.map((d) => (
              <div
                key={d.id}
                className="card"
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>{d.theme}</strong>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {d.season} ·{" "}
                    {d.status === "UPCOMING"
                      ? "Draft – pending admin review"
                      : d.status.replace(/_/g, " ")}
                  </div>
                </div>
                {d.status === "UPCOMING" && (
                  <button
                    type="button"
                    className="button danger small"
                    onClick={() => handleDelete(d.id)}
                    disabled={isPending}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
