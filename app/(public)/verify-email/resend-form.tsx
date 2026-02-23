"use client";

import { useFormState } from "react-dom";
import { resendVerificationEmail } from "@/lib/email-verification-actions";

const initialState = { status: "", message: "" };

export default function ResendVerificationForm({ initialEmail }: { initialEmail: string }) {
  const [state, action] = useFormState(resendVerificationEmail, initialState);

  if (state.status === "success") {
    return (
      <p className="form-success" style={{ margin: 0 }}>{state.message}</p>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {state.status === "error" && (
        <p className="form-error" style={{ margin: 0 }}>{state.message}</p>
      )}
      <label className="form-row" style={{ margin: 0 }}>
        Email address
        <input
          className="input"
          name="email"
          type="email"
          required
          defaultValue={initialEmail}
          placeholder="your@email.com"
        />
      </label>
      <button className="button secondary" type="submit">
        Resend Verification Email
      </button>
    </form>
  );
}
