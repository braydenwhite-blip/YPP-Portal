"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { signUp } from "@/lib/signup-actions";
import { useEffect, useState } from "react";

const initialState = { status: "idle", message: "" };

export default function SignupPage() {
  const [state, formAction] = useFormState(signUp, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function loadChapters() {
      const response = await fetch("/api/chapters");
      if (!response.ok) return;
      const data = await response.json();
      setChapters(Array.isArray(data) ? data : []);
    }
    loadChapters();
  }, []);

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          Create your account
        </h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          This creates a student account. Admin approval is required to enroll in courses.
        </p>
        <form action={formAction}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Full Name
            <input className="input" name="name" required />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, marginTop: 12, display: "block" }}>
            Email
            <input className="input" name="email" type="email" required />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, marginTop: 12, display: "block" }}>
            Phone (optional)
            <input className="input" name="phone" type="tel" />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, marginTop: 12, display: "block" }}>
            Password
            <input className="input" name="password" type="password" required />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600, marginTop: 12, display: "block" }}>
            Chapter (optional)
            <select className="input" name="chapterId" defaultValue="">
              <option value="">Select a chapter</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>
          {state.message ? (
            <p style={{ color: state.status === "error" ? "#b91c1c" : "#166534", marginTop: 12 }}>
              {state.message}
            </p>
          ) : null}
          <button className="button" type="submit">
            Create Account
          </button>
        </form>
        <div className="login-help">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
