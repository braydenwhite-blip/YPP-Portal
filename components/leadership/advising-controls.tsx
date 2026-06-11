"use client";

// Client controls for the Student Advisor workflow on the advising detail
// page: note/check-in composer, advising status, follow-up flag, next steps,
// and next-step recommendations.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdvisingStatus } from "@prisma/client";
import {
  addAdvisingNote,
  addAdvisingRecommendation,
  endAdvisorAssignment,
  setAdvisingStatus,
  setFollowUpFlag,
  setNextSteps,
  updateRecommendationStatus,
} from "@/lib/leadership/advisor-actions";
import {
  ADVISING_STATUSES,
  ADVISING_STATUS_META,
  RECOMMENDATION_KINDS,
  RECOMMENDATION_KIND_LABELS,
  type AdvisingNoteKind,
  type RecommendationKind,
  type RecommendationStatus,
} from "@/lib/leadership/constants";

export function AdvisingStatusSelect({
  assignmentId,
  status,
}: {
  assignmentId: string;
  status: AdvisingStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(event) => {
        const next = event.target.value as AdvisingStatus;
        startTransition(async () => {
          await setAdvisingStatus(assignmentId, next);
          router.refresh();
        });
      }}
      style={{ fontSize: 12, padding: "3px 6px", borderRadius: 6 }}
      aria-label="Advising status"
    >
      {ADVISING_STATUSES.map((option) => (
        <option key={option} value={option}>
          {ADVISING_STATUS_META[option].label}
        </option>
      ))}
    </select>
  );
}

export function FollowUpToggle({
  assignmentId,
  needsFollowUp,
  followUpNote,
}: {
  assignmentId: string;
  needsFollowUp: boolean;
  followUpNote: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(followUpNote ?? "");

  if (needsFollowUp && !editing) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="pill pill-small pill-attention">Follow-up: {followUpNote || "needed"}</span>
        <button
          className="button ghost small"
          style={{ fontSize: 12 }}
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await setFollowUpFlag({ assignmentId, needsFollowUp: false });
              router.refresh();
            });
          }}
        >
          Clear
        </button>
      </span>
    );
  }

  if (!editing) {
    return (
      <button className="button secondary small" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>
        Flag for follow-up
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Why does this student need follow-up?"
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e5e7eb", minWidth: 220 }}
      />
      <button
        className="button small"
        style={{ fontSize: 12 }}
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await setFollowUpFlag({ assignmentId, needsFollowUp: true, followUpNote: note.trim() || undefined });
            setEditing(false);
            router.refresh();
          });
        }}
      >
        Flag
      </button>
      <button className="button ghost small" style={{ fontSize: 12 }} onClick={() => setEditing(false)}>
        Cancel
      </button>
    </span>
  );
}

export function NextStepsEditor({
  assignmentId,
  nextSteps,
}: {
  assignmentId: string;
  nextSteps: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nextSteps ?? "");

  if (!editing) {
    return (
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 13, whiteSpace: "pre-wrap" }}>
          {nextSteps || <em style={{ color: "var(--muted, #6b7280)" }}>No next steps recorded yet.</em>}
        </p>
        <button className="button secondary small" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>
          {nextSteps ? "Edit next steps" : "Set next steps"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={3}
        placeholder="What does this student need next? e.g. Join the robotics project, apply for mentorship, start the instructor pathway…"
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button small"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await setNextSteps(assignmentId, value);
              setEditing(false);
              router.refresh();
            });
          }}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button className="button ghost small" onClick={() => setEditing(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AdvisingNoteComposer({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<AdvisingNoteKind>("CHECK_IN");
  const [body, setBody] = useState("");

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="radio" checked={kind === "CHECK_IN"} onChange={() => setKind("CHECK_IN")} />
          Check-in
        </label>
        <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input type="radio" checked={kind === "NOTE"} onChange={() => setKind("NOTE")} />
          Note
        </label>
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder={
          kind === "CHECK_IN"
            ? "How did the check-in go? What's the student working on?"
            : "Advising note…"
        }
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <div>
        <button
          className="button small"
          disabled={isPending || body.trim().length === 0}
          onClick={() => {
            startTransition(async () => {
              await addAdvisingNote({ assignmentId, kind, body });
              setBody("");
              router.refresh();
            });
          }}
        >
          {isPending ? "Saving…" : kind === "CHECK_IN" ? "Log check-in" : "Add note"}
        </button>
      </div>
    </div>
  );
}

export function RecommendationComposer({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RecommendationKind>("CLASS");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  if (!open) {
    return (
      <button className="button secondary small" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>
        + Recommend next step
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value as RecommendationKind)}
        style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6, maxWidth: 200 }}
        aria-label="Recommendation kind"
      >
        {RECOMMENDATION_KINDS.map((option) => (
          <option key={option} value={option}>
            {RECOMMENDATION_KIND_LABELS[option]}
          </option>
        ))}
      </select>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="e.g. Join Robotics 201, Apply for student mentorship…"
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <textarea
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        rows={2}
        placeholder="Why this is the right next step (optional)"
        style={{ fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button small"
          disabled={isPending || title.trim().length === 0}
          onClick={() => {
            startTransition(async () => {
              await addAdvisingRecommendation({
                assignmentId,
                kind,
                title,
                detail: detail.trim() || undefined,
              });
              setTitle("");
              setDetail("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          {isPending ? "Saving…" : "Recommend"}
        </button>
        <button className="button ghost small" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function RecommendationStatusButtons({
  recommendationId,
  status,
}: {
  recommendationId: string;
  status: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function update(next: RecommendationStatus) {
    startTransition(async () => {
      await updateRecommendationStatus(recommendationId, next);
      router.refresh();
    });
  }

  if (status === "DONE" || status === "DISMISSED") {
    return <span className="pill pill-small pill-neutral">{status === "DONE" ? "Done" : "Dismissed"}</span>;
  }

  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {status === "SUGGESTED" && (
        <button className="button ghost small" style={{ fontSize: 11 }} disabled={isPending} onClick={() => update("IN_PROGRESS")}>
          Started
        </button>
      )}
      <button className="button ghost small" style={{ fontSize: 11 }} disabled={isPending} onClick={() => update("DONE")}>
        Done
      </button>
      <button className="button ghost small" style={{ fontSize: 11 }} disabled={isPending} onClick={() => update("DISMISSED")}>
        Dismiss
      </button>
    </span>
  );
}

export function EndAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="button ghost small" style={{ fontSize: 12 }} onClick={() => setConfirming(true)}>
        End assignment
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button
        className="button small"
        style={{ fontSize: 12, background: "#dc2626" }}
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await endAdvisorAssignment(assignmentId);
            router.refresh();
          });
        }}
      >
        {isPending ? "Ending…" : "Confirm end"}
      </button>
      <button className="button ghost small" style={{ fontSize: 12 }} onClick={() => setConfirming(false)}>
        Keep
      </button>
    </span>
  );
}
