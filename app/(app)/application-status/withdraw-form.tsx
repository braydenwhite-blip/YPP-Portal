"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { withdrawInstructorApplication } from "@/lib/instructor-application-actions";

const initialState = { status: "idle" as const, message: "" };

function WithdrawSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="button"
      disabled={pending}
      style={{ background: "#dc2626", color: "white" }}
    >
      {pending ? "Withdrawing…" : "Withdraw application"}
    </button>
  );
}

export default function WithdrawForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(withdrawInstructorApplication, initialState);

  if (state.status === "success") {
    return (
      <div
        role="status"
        style={{
          marginTop: 16,
          padding: "10px 14px",
          borderRadius: 8,
          background: "#f5f5f4",
          color: "#57534e",
          fontSize: 13,
        }}
      >
        Your application has been withdrawn. You can re-apply at any time.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="button ghost"
        onClick={() => setOpen(true)}
        style={{ marginTop: 16, fontSize: 13, color: "#dc2626" }}
      >
        Withdraw this application
      </button>
    );
  }

  return (
    <form action={action} style={{ marginTop: 16, padding: 16, border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface-2)" }}>
      <strong style={{ display: "block", marginBottom: 6 }}>Withdraw your application?</strong>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.5 }}>
        This stops the review process. You can re-apply later — the new application
        will be flagged as a re-application so reviewers see your prior context.
      </p>
      <label style={{ fontSize: 13, fontWeight: 500, display: "block" }}>
        Reason (optional, shared with the review team)
        <textarea
          name="reason"
          rows={3}
          maxLength={2000}
          className="input"
          style={{ marginTop: 4 }}
          placeholder="e.g. Schedule changed, applying again later, etc."
        />
      </label>
      {state.status === "error" && (
        <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{state.message}</p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <WithdrawSubmit />
        <button
          type="button"
          className="button ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
