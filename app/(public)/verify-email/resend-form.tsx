"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export default function ResendVerificationForm({ initialEmail }: { initialEmail: string }) {
  const [status, setStatus] = useState<"" | "success" | "error">("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("success");
      setMessage("Verification email sent! Check your inbox.");
    }
  }

  if (status === "success") {
    return (
      <p className="form-success" style={{ margin: 0 }}>{message}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {status === "error" && (
        <p className="form-error" style={{ margin: 0 }}>{message}</p>
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
