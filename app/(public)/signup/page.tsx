"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { signUp } from "@/lib/signup-actions";
import { useEffect, useState } from "react";

const initialState = { status: "idle" as const, message: "" };

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
      <div className="login-card" style={{ justifySelf: "center" }}>
        <div className="login-card-header">
          <Image
            src="/logo-icon.svg"
            alt="YPP"
            width={44}
            height={44}
          />
          <div>
            <h1 className="page-title" style={{ fontSize: 20 }}>
              Join Youth Passion Project
            </h1>
            <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
              Create your student or instructor account to get started
            </p>
          </div>
        </div>
        <form action={formAction}>
          <label className="form-label" style={{ marginTop: 0 }}>
            Full Name
            <input className="input" name="name" placeholder="Your full name" required />
          </label>
          <label className="form-label">
            Email
            <input className="input" name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label className="form-label">
            Phone (optional)
            <input className="input" name="phone" type="tel" placeholder="(555) 123-4567" />
          </label>
          <label className="form-label">
            Password
            <input className="input" name="password" type="password" placeholder="Min 8 characters" required />
          </label>
          <label className="form-label">
            Account Type
            <select className="input" name="accountType" defaultValue="STUDENT">
              <option value="STUDENT">Student</option>
              <option value="INSTRUCTOR">Instructor</option>
            </select>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Instructors can sign up here, then finish onboarding after signing in.
            </span>
          </label>
          <label className="form-label">
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
          {state.message && (
            <div className={state.status === "error" ? "form-error" : "form-success"}>
              {state.message}
            </div>
          )}
          <button className="button" type="submit">
            Create Account
          </button>
        </form>
        <div className="login-help">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
        <div className="login-help" style={{ marginTop: 8 }}>
          Are you a parent/guardian? <Link href="/signup/parent">Parent signup</Link>
        </div>
      </div>
    </div>
  );
}
