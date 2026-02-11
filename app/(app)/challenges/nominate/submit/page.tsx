"use client";

import { useState } from "react";
import { nominateChallenge } from "@/lib/engagement-actions";
import Link from "next/link";

export default function NominateSubmitPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      await nominateChallenge(formData);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Challenge Nominated!</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>Your challenge idea has been submitted</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Other students can now vote on it. You earned 10 XP for your nomination!
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Link href="/challenges/nominate" className="button primary">View Nominations</Link>
            <button onClick={() => setSubmitted(false)} className="button secondary">Nominate Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Nominate a Challenge</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Suggest a challenge for the community
          </p>
        </div>
        <Link href="/challenges/nominate" className="button secondary">Back to Nominations</Link>
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <form action={handleSubmit}>
          {error && (
            <div style={{ background: "#fee2e2", color: "#dc2626", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Challenge Title *
            </label>
            <input name="title" required placeholder="Name your challenge" className="input" style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Description *
            </label>
            <textarea
              name="description"
              rows={4}
              required
              placeholder="Describe what participants should do..."
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Passion Area
              </label>
              <input name="category" placeholder="e.g., Music, Art" className="input" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Difficulty
              </label>
              <select name="difficulty" className="input" style={{ width: "100%" }}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Suggested XP Reward
              </label>
              <input name="suggestedXp" type="number" defaultValue={25} min={5} max={200} className="input" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Suggested Duration
              </label>
              <input name="suggestedDuration" placeholder="e.g., 1 day, 1 week" className="input" style={{ width: "100%" }} />
            </div>
          </div>

          <button type="submit" className="button primary" style={{ width: "100%" }}>
            Submit Nomination
          </button>
        </form>
      </div>
    </div>
  );
}
