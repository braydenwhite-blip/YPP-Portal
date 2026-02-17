"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
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
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="button secondary"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
          </svg>
          Sign up with Google
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--muted)" }}>or create account with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
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
