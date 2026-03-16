"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ChairDecisionActions({
  decisionId,
  applicantName,
}: {
  decisionId: string;
  applicantName: string;
}) {
  const router = useRouter();
  const [chairNote, setChairNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/hiring-decisions/${decisionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chairNote }),
      });

      const payload = await response.json().catch(() => ({ error: "Approval failed." }));
      if (!response.ok) {
        setError(payload.error || "Approval failed.");
        return;
      }

      setSuccess(`Decision approved for ${applicantName}.`);
      setChairNote("");
      router.refresh();
    });
  }

  function handleReturn() {
    if (!chairNote.trim()) {
      setError("Add a Chair note before returning this decision.");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/hiring-decisions/${decisionId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chairNote }),
      });

      const payload = await response.json().catch(() => ({ error: "Return failed." }));
      if (!response.ok) {
        setError(payload.error || "Return failed.");
        return;
      }

      setSuccess(`Decision returned to the submitter for revision.`);
      setChairNote("");
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 14 }}>
      <label className="form-row" style={{ marginBottom: 10 }}>
        Chair note
        <textarea
          className="input"
          rows={3}
          value={chairNote}
          onChange={(event) => setChairNote(event.target.value)}
          placeholder="Optional on approval. Required if you return the decision."
          disabled={isPending}
        />
      </label>

      {error ? (
        <p style={{ color: "var(--color-error)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p style={{ color: "var(--color-success)", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {success}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="button small" onClick={handleApprove} disabled={isPending}>
          {isPending ? "Saving..." : "Approve Decision"}
        </button>
        <button
          type="button"
          className="button small outline"
          onClick={handleReturn}
          disabled={isPending}
          style={{ color: "#b45309" }}
        >
          {isPending ? "Saving..." : "Return for Revision"}
        </button>
      </div>
    </div>
  );
}
