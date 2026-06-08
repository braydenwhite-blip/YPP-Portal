"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { completeMentorshipToAlumni } from "@/lib/mentorship-2/completion-actions";

export function GraduateToAlumniButton({
  mentorshipId,
  alreadyComplete,
}: {
  mentorshipId: string;
  alreadyComplete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradYear, setGradYear] = useState("");
  const [college, setCollege] = useState("");

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await completeMentorshipToAlumni({
          mentorshipId,
          graduationYear: gradYear ? Number(gradYear) : undefined,
          college: college.trim() || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not complete mentorship.");
      }
    });
  }

  if (alreadyComplete) {
    return (
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        ✓ This mentorship is complete and the mentee is in the Alumni network.
      </p>
    );
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="button secondary small" onClick={() => setOpen(true)}>
          Complete &amp; graduate to Alumni
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Graduation year (optional)</span>
        <input
          type="number"
          value={gradYear}
          onChange={(e) => setGradYear(e.target.value)}
          min={1900}
          max={2100}
          placeholder="e.g. 2027"
        />
      </label>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>College (optional)</span>
        <input
          value={college}
          onChange={(e) => setCollege(e.target.value)}
          maxLength={200}
        />
      </label>
      {error && (
        <p role="alert" style={{ color: "var(--color-danger, #c0392b)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="button small" disabled={isPending} onClick={submit}>
          {isPending ? "Completing…" : "Confirm completion"}
        </button>
        <button
          type="button"
          className="button secondary small"
          disabled={isPending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
