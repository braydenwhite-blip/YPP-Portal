"use client";

import { useState, useTransition, type FormEvent } from "react";
import { withdrawInstructorApplication } from "@/lib/instructor-application-actions";

type WithdrawState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initial: WithdrawState = { status: "idle", message: "" };

export default function WithdrawInstructorApplicationForm() {
  const [state, setState] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (state.status === "success") {
    return (
      <div className="form-success" style={{ marginTop: 12 }} aria-live="polite">
        {state.message}
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await withdrawInstructorApplication(initial, formData);
      setState(next);
      if (next.status === "success") {
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="button small ghost"
          onClick={() => setConfirming(true)}
        >
          Withdraw application
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>
        Withdrawing closes this application and notifies the review team. You can re-apply later.
      </p>
      <label className="form-label" style={{ marginTop: 0 }}>
        Reason (optional)
        <textarea
          className="input"
          name="reason"
          rows={3}
          maxLength={500}
          placeholder="Help us improve — why are you withdrawing?"
          style={{ resize: "vertical" }}
        />
      </label>
      {state.status === "error" && (
        <div className="form-error" aria-live="polite">{state.message}</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Withdrawing…" : "Confirm withdrawal"}
        </button>
        <button
          type="button"
          className="button small ghost"
          onClick={() => setConfirming(false)}
          disabled={isPending}
        >
          Never mind
        </button>
      </div>
    </form>
  );
}
