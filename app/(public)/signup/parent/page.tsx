"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { signUpParent } from "@/lib/signup-actions";

const initialState = { status: "idle" as const, message: "" };

export default function ParentSignupPage() {
  const [state, formAction] = useFormState(signUpParent, initialState);

  return (
    <div className="login-shell">
      <div className="login-grid" style={{ maxWidth: 1000 }}>
        <div className="login-hero">
          <div className="login-logo">
            <Image src="/logo-icon.svg" alt="YPP" width={48} height={48} />
            <span className="login-logo-text">Youth Passion Project</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 28, marginBottom: 12 }}>
            Parent & Guardian Portal
          </h1>
          <p className="hero-subtitle">
            Stay connected with your child&apos;s learning journey. Track their progress,
            view course enrollments, and sign them up for new classes.
          </p>

          <div className="hero-grid" style={{ marginTop: 24 }}>
            <div className="hero-card">
              <h3>Track Progress</h3>
              <p>See your child&apos;s course completions, XP, and pathway progress in real time.</p>
            </div>
            <div className="hero-card">
              <h3>Enroll in Courses</h3>
              <p>Browse available courses and sign your child up directly from the portal.</p>
            </div>
            <div className="hero-card">
              <h3>Stay Informed</h3>
              <p>View attendance records, certificates earned, and mentor feedback.</p>
            </div>
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-header">
            <Image src="/logo-icon.svg" alt="YPP" width={40} height={40} />
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Create Parent Account
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Register to access your child&apos;s portal
              </p>
            </div>
          </div>

          <form action={formAction}>
            <label className="form-label" style={{ marginTop: 0 }}>
              Your Full Name
              <input className="input" name="name" placeholder="Your full name" required />
            </label>
            <label className="form-label">
              Your Email
              <input className="input" name="email" type="email" placeholder="parent@example.com" required />
            </label>
            <label className="form-label">
              Phone (optional)
              <input className="input" name="phone" type="tel" placeholder="(555) 123-4567" />
            </label>
            <label className="form-label">
              Password
              <input className="input" name="password" type="password" placeholder="Min 8 characters" required />
            </label>

            <div style={{
              marginTop: 20,
              padding: 16,
              background: "var(--ypp-purple-50)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--ypp-purple-200)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ypp-purple-800)", marginBottom: 8 }}>
                Link to Your Child (optional)
              </div>
              <label className="form-label" style={{ marginTop: 0 }}>
                Child&apos;s Email
                <input className="input" name="childEmail" type="email" placeholder="child@example.com" />
              </label>
              <label className="form-label">
                Relationship
                <select className="input" name="relationship" defaultValue="Parent">
                  <option value="Parent">Parent</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Other">Other</option>
                </select>
              </label>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                An admin will approve the connection before you can view your child&apos;s progress.
                You can also link children later from your dashboard.
              </p>
            </div>

            {state.message && (
              <div className={state.status === "error" ? "form-error" : "form-success"}>
                {state.message}
              </div>
            )}
            <button className="button" type="submit">
              Create Parent Account
            </button>
          </form>

          <div className="login-help">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
          <div className="login-help" style={{ marginTop: 8 }}>
            Are you a student? <Link href="/signup">Student signup</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
