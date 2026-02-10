"use client";

import { useState } from "react";
import { startCertification, updateCertificationRequirement, submitCertification } from "@/lib/real-world-actions";

export function StartCertForm({ certType }: { certType: string }) {
  const [loading, setLoading] = useState(false);
  const [passionArea, setPassionArea] = useState("");

  async function handleStart() {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("certType", certType);
      if (passionArea) formData.set("passionArea", passionArea);
      await startCertification(formData);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
      {certType === "Specialist" && (
        <select value={passionArea} onChange={(e) => setPassionArea(e.target.value)} style={{ flex: 1 }}>
          <option value="">Passion area...</option>
          {["Art", "Music", "Writing", "Dance", "Theater", "Film", "Coding", "Science"].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      )}
      <button className="button primary small" onClick={handleStart} disabled={loading}>
        {loading ? "Starting..." : "Begin"}
      </button>
    </div>
  );
}

export function RequirementToggle({ certId, requirementIndex }: { certId: string; requirementIndex: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState("");

  async function handleComplete() {
    if (!evidence.trim()) { alert("Please provide evidence"); return; }
    setLoading(true);
    try {
      await updateCertificationRequirement(certId, requirementIndex, evidence);
      setOpen(false);
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="button secondary small" onClick={() => setOpen(true)} style={{ fontSize: 11, padding: "2px 8px" }}>
        Complete
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input type="text" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence/link..." style={{ fontSize: 11, padding: "2px 6px", width: 150 }} />
      <button className="button primary small" onClick={handleComplete} disabled={loading} style={{ fontSize: 11, padding: "2px 6px" }}>
        {loading ? "..." : "Done"}
      </button>
      <button className="button secondary small" onClick={() => setOpen(false)} style={{ fontSize: 11, padding: "2px 6px" }}>X</button>
    </div>
  );
}

export function SubmitCertButton({ certId }: { certId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!confirm("Submit for review?")) return;
    setLoading(true);
    try { await submitCertification(certId); } catch (e: any) { alert(e.message); }
    setLoading(false);
  }

  return (
    <button className="button primary" onClick={handleSubmit} disabled={loading}>
      {loading ? "Submitting..." : "Submit for Review"}
    </button>
  );
}
