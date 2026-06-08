"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitInstructorReflection } from "@/lib/class-feedback-actions";

type YesNo = "yes" | "no" | "";

/**
 * Instructor wrap-up reflection on the class detail page. Pre-filled from the
 * saved ClassOutcome row so it reads as "edit my reflection" once submitted.
 */
export function InstructorReflectionForm({
  offeringId,
  defaultWentWell = "",
  defaultChallenges = "",
  defaultStudentImpact = "",
  defaultWouldTeachAgain = "",
  reflectedAt,
}: {
  offeringId: string;
  defaultWentWell?: string;
  defaultChallenges?: string;
  defaultStudentImpact?: string;
  defaultWouldTeachAgain?: YesNo;
  reflectedAt?: Date | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wentWell, setWentWell] = useState(defaultWentWell);
  const [challenges, setChallenges] = useState(defaultChallenges);
  const [studentImpact, setStudentImpact] = useState(defaultStudentImpact);
  const [wouldTeachAgain, setWouldTeachAgain] = useState<YesNo>(
    defaultWouldTeachAgain,
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(reflectedAt ?? null);

  function handleSubmit() {
    if (!wentWell.trim() && !challenges.trim() && !studentImpact.trim() && !wouldTeachAgain) {
      setError("Add at least one note before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("offeringId", offeringId);
        fd.set("wentWell", wentWell);
        fd.set("challenges", challenges);
        fd.set("studentImpact", studentImpact);
        fd.set("wouldTeachAgain", wouldTeachAgain);
        await submitInstructorReflection(fd);
        setSavedAt(new Date());
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save your reflection.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
        A short wrap-up once your class is ending. Your reflection goes to the
        YPP team alongside student feedback to help plan the next run.
        {savedAt ? (
          <>
            {" "}
            <span style={{ color: "#166534", fontWeight: 600 }}>
              Saved{" "}
              {new Date(savedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              .
            </span>
          </>
        ) : null}
      </p>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        What went well?
        <textarea
          className="input"
          rows={3}
          value={wentWell}
          onChange={(e) => setWentWell(e.target.value)}
          placeholder="Highlights, what landed, moments you were proud of…"
          style={{ fontSize: 14, resize: "vertical", marginTop: 4, fontWeight: 400 }}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        What was hard / what would you change?
        <textarea
          className="input"
          rows={3}
          value={challenges}
          onChange={(e) => setChallenges(e.target.value)}
          placeholder="Pacing, materials, attendance, anything you'd adjust next time…"
          style={{ fontSize: 14, resize: "vertical", marginTop: 4, fontWeight: 400 }}
        />
      </label>

      <label style={{ fontSize: 13, fontWeight: 600 }}>
        What did students get out of it?
        <textarea
          className="input"
          rows={2}
          value={studentImpact}
          onChange={(e) => setStudentImpact(e.target.value)}
          placeholder="Skills, projects, growth you saw in your students…"
          style={{ fontSize: 14, resize: "vertical", marginTop: 4, fontWeight: 400 }}
        />
      </label>

      <div>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
          Would you teach this class again?
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["yes", "no"] as const).map((option) => {
            const selected = wouldTeachAgain === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setWouldTeachAgain(selected ? "" : option)}
                className={`button ${selected ? "primary" : "secondary"}`}
                style={{ fontSize: 13, textTransform: "capitalize" }}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{error}</p>}

      <button
        className="button primary"
        onClick={handleSubmit}
        disabled={isPending}
        style={{ fontSize: 14, alignSelf: "flex-start" }}
      >
        {isPending ? "Saving…" : savedAt ? "Update reflection" : "Save reflection"}
      </button>
    </div>
  );
}
