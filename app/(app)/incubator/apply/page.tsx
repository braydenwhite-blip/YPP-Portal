"use client";

import { useState, useEffect } from "react";
import { applyToIncubator, getActiveCohort } from "@/lib/incubator-actions";
import Link from "next/link";

export default function ApplyToIncubatorPage() {
  const [cohort, setCohort] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveCohort()
      .then((c) => setCohort(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(formData: FormData) {
    try {
      await applyToIncubator(formData);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  }

  if (loading) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Apply to Incubator</h1></div>
        <div className="card"><p style={{ color: "var(--text-secondary)" }}>Loading...</p></div>
      </div>
    );
  }

  if (!cohort || cohort.status !== "ACCEPTING_APPLICATIONS") {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Apply to Incubator</h1></div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No cohort accepting applications right now</h3>
          <p style={{ color: "var(--text-secondary)" }}>Check back soon for the next incubator cohort!</p>
          <Link href="/incubator" className="button secondary" style={{ marginTop: 12 }}>Back to Incubator</Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Application Submitted!</h1></div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>Your application is in!</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            You applied to <strong>{cohort.name}</strong>. You earned 20 XP!
          </p>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            We&apos;ll review your application and let you know when you&apos;re accepted.
          </p>
          <Link href="/incubator" className="button primary">Back to Incubator</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Apply to the Incubator</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {cohort.name} &mdash; Tell us about your passion project idea
          </p>
        </div>
        <Link href="/incubator" className="button secondary">Back</Link>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        <form action={handleSubmit}>
          <input type="hidden" name="cohortId" value={cohort.id} />

          {error && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Project Title *
            </label>
            <input name="projectTitle" required placeholder="What will you call your project?" className="input" style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Passion Area *
            </label>
            <input name="passionArea" required placeholder="e.g., Music Production, Robotics, Dance, Painting" className="input" style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              What&apos;s your project idea? *
            </label>
            <textarea
              name="projectIdea"
              required
              rows={4}
              placeholder="Describe what you want to create or build. What does the finished project look like?"
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Why does this project matter to you? *
            </label>
            <textarea
              name="whyThisProject"
              required
              rows={3}
              placeholder="Why are you passionate about this? What got you interested?"
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              What have you done so far? (optional)
            </label>
            <textarea
              name="priorExperience"
              rows={3}
              placeholder="Any skills, classes, or practice you've done related to this project"
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              What are your goals for this project? *
            </label>
            <textarea
              name="goals"
              required
              rows={3}
              placeholder="What do you hope to learn, accomplish, or create by the end?"
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Would you like a mentor?
              </label>
              <select name="needsMentor" className="input" style={{ width: "100%" }}>
                <option value="true">Yes, I&apos;d love a mentor</option>
                <option value="false">No, I&apos;m good for now</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Mentor preference (optional)
              </label>
              <input
                name="mentorPreference"
                placeholder="e.g., Someone who knows guitar"
                className="input"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <button type="submit" className="button primary" style={{ width: "100%", marginTop: 8 }}>
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}
