"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import BrandLockup from "@/components/brand-lockup";
import { signUpFamily } from "@/lib/family-signup-actions";

const initialState = { status: "idle" as const, message: "" };

export default function FamilySignupPage() {
  const [state, formAction] = useFormState(signUpFamily, initialState);
  const [chapters, setChapters] = useState<Array<{ id: string; name: string }>>([]);
  const [studentUsesParentPhone, setStudentUsesParentPhone] = useState(true);
  const [submittedParentEmail, setSubmittedParentEmail] = useState("");
  const [submittedStudentEmail, setSubmittedStudentEmail] = useState("");

  useEffect(() => {
    async function loadChapters() {
      const response = await fetch("/api/chapters");
      if (!response.ok) return;
      const data = await response.json();
      setChapters(Array.isArray(data) ? data : []);
    }

    loadChapters();
  }, []);

  if (state.status === "success" && state.message === "FAMILY_SETUP_SENT") {
    return (
      <div className="login-shell">
        <div className="login-card" style={{ justifySelf: "center" }}>
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h1 className="page-title" style={{ fontSize: 20 }}>
                Check Both Inboxes
              </h1>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                The family setup links are on the way
              </p>
            </div>
          </div>

          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
            We sent a parent setup link to <strong>{submittedParentEmail || "the parent email"}</strong> and a
            student setup link to <strong>{submittedStudentEmail || "the student email"}</strong>.
          </p>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
            Each person should open their own email, click their link, and choose a password to finish setup.
          </p>

          <Link className="button" style={{ display: "block", textAlign: "center" }} href="/login">
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <div className="login-grid" style={{ maxWidth: 1080 }}>
        <section className="login-hero">
          <div className="login-logo login-logo--lockup">
            <BrandLockup height={52} className="brand-lockup" priority reloadOnClick />
          </div>
          <p className="badge">Family Onboarding</p>
          <h1 className="page-title mt-8">Start your family&apos;s Youth Passion Project account.</h1>
          <p className="hero-subtitle mt-12">
            This form is for a parent or guardian. We collect the parent and student details together, then we send each person
            their own account setup link.
          </p>
          <div className="hero-grid">
            <div className="hero-card">
              <h3>Step 1</h3>
              <p>Tell us the parent contact details and the student basics in one place.</p>
            </div>
            <div className="hero-card">
              <h3>Step 2</h3>
              <p>We match existing accounts when it is safe, or create the missing family accounts for you.</p>
            </div>
            <div className="hero-card">
              <h3>Step 3</h3>
              <p>The parent and student each get a separate setup email so both accounts can be finished correctly.</p>
            </div>
          </div>
        </section>

        <div className="login-card">
          <div className="login-card-header login-card-header--stacked">
            <BrandLockup height={36} className="brand-lockup" reloadOnClick />
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Create Family Account
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Parent-led signup for one student and one parent or guardian
              </p>
            </div>
          </div>

          <form
            action={formAction}
            onSubmit={(event) => {
              const data = new FormData(event.currentTarget);
              setSubmittedParentEmail(String(data.get("parentEmail") ?? ""));
              setSubmittedStudentEmail(String(data.get("studentEmail") ?? ""));
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Parent or guardian
            </div>

            <label className="form-label" style={{ marginTop: 0 }}>
              Parent full name
              <input className="input" name="parentName" placeholder="Parent or guardian full name" required />
            </label>

            <label className="form-label">
              Parent email
              <input className="input" name="parentEmail" type="email" placeholder="parent@example.com" required />
            </label>

            <label className="form-label">
              Parent phone
              <input className="input" name="parentPhone" type="tel" placeholder="(555) 123-4567" required />
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Student details
            </div>

            <label className="form-label">
              Student full name
              <input className="input" name="studentName" placeholder="Student full name" required />
            </label>

            <label className="form-label">
              Student email
              <input className="input" name="studentEmail" type="email" placeholder="student@example.com" required />
            </label>

            <div className="grid two">
              <label className="form-label">
                Student date of birth
                <input className="input" name="studentDateOfBirth" type="date" required />
              </label>
              <label className="form-label">
                Grade for current academic year
                <input className="input" name="studentGrade" type="number" min={1} max={12} placeholder="e.g. 9" required />
              </label>
            </div>

            <label className="form-label">
              Student school
              <input className="input" name="studentSchool" placeholder="e.g. Lincoln High School" required />
            </label>

            <label className="form-label">
              Student phone
              <input
                className="input"
                name="studentPhone"
                type="tel"
                placeholder={studentUsesParentPhone ? "Using the parent phone number above" : "(555) 123-4567"}
                disabled={studentUsesParentPhone}
              />
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: -2, marginBottom: 14, fontSize: 13, color: "var(--muted)" }}>
              <input
                type="checkbox"
                name="studentUsesParentPhone"
                checked={studentUsesParentPhone}
                onChange={(event) => setStudentUsesParentPhone(event.target.checked)}
              />
              Use the parent phone number for the student too.
            </label>

            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "16px 0 12px" }} />

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Location
            </div>

            <div className="grid two">
              <label className="form-label">
                City
                <input className="input" name="city" placeholder="e.g. Phoenix" required />
              </label>
              <label className="form-label">
                State
                <input className="input" name="stateProvince" placeholder="e.g. Arizona" required />
              </label>
            </div>

            <label className="form-label">
              Chapter
              <select className="input" name="chapterId" defaultValue="" required>
                <option value="" disabled>
                  Select a chapter
                </option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>

            {state.message && state.message !== "FAMILY_SETUP_SENT" && (
              <div className={state.status === "error" ? "form-error" : "form-success"}>
                {state.message}
              </div>
            )}

            <button className="button" type="submit">
              Create Family Account
            </button>
          </form>

          <div className="login-help">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
          <div className="login-help" style={{ marginTop: 8 }}>
            Applying to teach? <Link href="/signup/instructor">Instructor application</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
