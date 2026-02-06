"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/"
    });

    if (result?.error) {
      setError("Invalid email or password. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="login-shell">
      <div className="login-grid">
        <section className="login-hero">
          <div className="login-logo">
            <Image
              src="/logo-icon.svg"
              alt="Youth Passion Project"
              width={52}
              height={52}
            />
            <span className="login-logo-text">Youth Passion Project</span>
          </div>
          <p className="badge">Pathways Portal</p>
          <h1 className="page-title mt-8">
            Build a full learning journey, not just a class.
          </h1>
          <p className="hero-subtitle mt-12">
            The Pathways Portal connects curriculum, mentorship, events, and instructor training so every
            chapter can guide students from their first class to a portfolio-ready project.
          </p>
          <div className="hero-grid">
            <div className="hero-card">
              <h3>Curriculum Ladder</h3>
              <p>Track one-off classes, 101/201/301 sequences, and labs in one view.</p>
            </div>
            <div className="hero-card">
              <h3>Mentorship + Growth</h3>
              <p>Pair instructors and students with check-ins that keep progress on track.</p>
            </div>
            <div className="hero-card">
              <h3>Training Readiness</h3>
              <p>Approve instructors by level with clear training milestones and status.</p>
            </div>
          </div>
          <div className="hero-metrics">
            <div>
              <div className="kpi">101 &rarr; 301</div>
              <div className="kpi-label">Leveled Pathways</div>
            </div>
            <div>
              <div className="kpi">Labs + Commons</div>
              <div className="kpi-label">Project-Based Growth</div>
            </div>
            <div>
              <div className="kpi">Mentorship</div>
              <div className="kpi-label">Monthly Check-Ins</div>
            </div>
          </div>
        </section>

        <div className="login-card">
          <div className="login-card-header">
            <Image
              src="/logo-icon.svg"
              alt="YPP"
              width={44}
              height={44}
            />
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>
                Welcome Back
              </h2>
              <p className="page-subtitle mt-0" style={{ fontSize: 13 }}>
                Sign in to your Pathways Portal
              </p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="form-label" style={{ marginTop: 0 }}>
              Email
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="form-label">
              Password
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <div className="login-help">
            Need a demo login? Use the credentials listed in the README.
          </div>
          <Link className="button secondary" style={{ display: "block", textAlign: "center" }} href="/signup">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
