"use client";

import { useState } from "react";
import { createPassport, earnStamp } from "@/lib/challenge-gamification-actions";

export function CreatePassportForm({ availableAreas }: { availableAreas: string[] }) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");

  async function handleCreate() {
    if (!selected) return;
    setLoading(true);
    try {
      await createPassport(selected);
      setSelected("");
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="card" style={{ display: "flex", alignItems: "end", gap: 12 }}>
      <div className="form-group" style={{ flex: 1, margin: 0 }}>
        <label htmlFor="newPassport" style={{ fontSize: 13, fontWeight: 600 }}>
          Start a New Passport
        </label>
        <select
          id="newPassport"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a passion area...</option>
          {availableAreas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>
      <button
        className="button primary"
        onClick={handleCreate}
        disabled={loading || !selected}
      >
        {loading ? "Creating..." : "Create Passport"}
      </button>
    </div>
  );
}

export function EarnStampForm({
  passportId,
  availableSubAreas,
}: {
  passportId: string;
  availableSubAreas: string[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("passportId", passportId);
      await earnStamp(formData);
      setOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        className="button secondary"
        onClick={() => setOpen(true)}
        style={{ width: "100%" }}
      >
        + Earn a Stamp
      </button>
    );
  }

  return (
    <form
      action={handleSubmit}
      style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}
    >
      <h4 style={{ margin: "0 0 12px" }}>Earn a New Stamp</h4>
      <div className="form-group">
        <label htmlFor="subArea">Sub-Area *</label>
        <select id="subArea" name="subArea" required>
          <option value="">Choose...</option>
          {availableSubAreas.map((area) => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="earnedBy">How did you earn it? *</label>
        <select id="earnedBy" name="earnedBy" required>
          <option value="">Choose...</option>
          <option value="TRY_IT">Tried it for the first time</option>
          <option value="CLASS">Took a class</option>
          <option value="PROJECT">Completed a project</option>
          <option value="PRACTICE_HOURS">Logged practice hours</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="description">What did you do?</label>
        <textarea id="description" name="description" rows={2} placeholder="Describe your experience..." />
      </div>
      <div className="form-group">
        <label htmlFor="evidence">Link to evidence (optional)</label>
        <input type="url" id="evidence" name="evidence" placeholder="https://..." />
      </div>
      <div className="form-group">
        <label htmlFor="hoursLogged">Hours logged (optional)</label>
        <input type="number" id="hoursLogged" name="hoursLogged" min="0" placeholder="0" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Earning..." : "Earn Stamp (+15 XP)"}
        </button>
        <button type="button" className="button secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
