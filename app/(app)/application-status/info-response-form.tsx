"use client";

import { useState, useTransition, type FormEvent } from "react";
import { submitInfoResponse } from "@/lib/instructor-application-actions";

type InfoResponseState = {
  status: "idle" | "success" | "error";
  message: string;
};

const initial: InfoResponseState = { status: "idle", message: "" };

export default function InfoResponseForm() {
  const [state, setState] = useState(initial);
  const [isPending, startTransition] = useTransition();

  if (state.status === "success") {
    return (
      <div className="form-success" style={{ marginBottom: 0 }} aria-live="polite">
        {state.message} The review team will follow up shortly.
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const nextState = await submitInfoResponse(initial, formData);
      setState(nextState);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="form-label" style={{ marginTop: 0 }}>
        Your Response
        <textarea
          className="input"
          name="applicantResponse"
          required
          rows={5}
          placeholder="Provide the additional information requested…"
          style={{ resize: "vertical" }}
        />
      </label>
      {state.status === "error" && (
        <div className="form-error" aria-live="polite">{state.message}</div>
      )}
      <button className="button" type="submit" disabled={isPending}>
        {isPending ? "Submitting…" : "Submit Response"}
      </button>
    </form>
  );
}
