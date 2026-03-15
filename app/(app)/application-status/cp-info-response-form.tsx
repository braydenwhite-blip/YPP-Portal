"use client";

import { useFormState } from "react-dom";
import { submitCPInfoResponse } from "@/lib/chapter-president-application-actions";

const initial = { status: "idle" as const, message: "" };

export default function CPInfoResponseForm() {
  const [state, action] = useFormState(submitCPInfoResponse, initial);

  if (state.status === "success") {
    return (
      <div className="form-success" style={{ marginBottom: 0 }}>
        {state.message} A reviewer will follow up shortly.
      </div>
    );
  }

  return (
    <form action={action}>
      <label className="form-label" style={{ marginTop: 0 }}>
        Your Response
        <textarea
          className="input"
          name="applicantResponse"
          required
          rows={5}
          placeholder="Provide the additional information requested..."
          style={{ resize: "vertical" }}
        />
      </label>
      {state.status === "error" && (
        <div className="form-error">{state.message}</div>
      )}
      <button className="button" type="submit">
        Submit Response
      </button>
    </form>
  );
}
