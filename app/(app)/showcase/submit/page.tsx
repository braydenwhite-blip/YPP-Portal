"use client";

import { useState } from "react";
import { submitContent } from "@/lib/engagement-actions";
import Link from "next/link";

const CONTENT_TYPES = [
  "VIDEO", "ARTICLE", "PROJECT", "TUTORIAL", "ART", "MUSIC", "CODE", "OTHER",
];

export default function SubmitContentPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    try {
      await submitContent(formData);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">Content Submitted!</h1>
        </div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
          <h2 style={{ marginBottom: 8 }}>Your work has been submitted for review</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            An instructor will review your submission. You earned 15 XP for sharing!
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Link href="/showcase" className="button primary">Back to Showcase</Link>
            <button onClick={() => setSubmitted(false)} className="button secondary">
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Share Your Work</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Submit your creation to the Student Showcase
          </p>
        </div>
        <Link href="/showcase" className="button secondary">Back to Showcase</Link>
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
              Title *
            </label>
            <input name="title" required placeholder="Give your work a title" className="input" style={{ width: "100%" }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              placeholder="Tell us about your creation..."
              className="input"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Content Type *
            </label>
            <select name="contentType" required className="input" style={{ width: "100%" }}>
              <option value="">Select type...</option>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Media URL
            </label>
            <input
              name="mediaUrl"
              type="url"
              placeholder="Link to your work (YouTube, Google Drive, etc.)"
              className="input"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Passion Area
            </label>
            <input
              name="passionArea"
              placeholder="e.g., Music, Art, Coding, Dance"
              className="input"
              style={{ width: "100%" }}
            />
          </div>

          <button type="submit" className="button primary" style={{ width: "100%" }}>
            Submit for Review
          </button>
        </form>
      </div>
    </div>
  );
}
