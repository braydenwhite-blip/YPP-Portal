"use client";

import { useState } from "react";
import { createInternshipListing, applyToInternship } from "@/lib/real-world-actions";

export function CreateListingButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await createInternshipListing(formData);
      setOpen(false);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="button primary" onClick={() => setOpen(true)}>
        Post Opportunity
      </button>
    );
  }

  return (
    <div className="card" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form action={handleSubmit} style={{ background: "var(--surface)", padding: 24, borderRadius: "var(--radius-lg)", maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
        <h3 style={{ marginBottom: 16 }}>Post an Opportunity</h3>
        <div className="form-group">
          <label>Title *</label>
          <input type="text" name="title" required placeholder="e.g., Summer Art Intern" />
        </div>
        <div className="form-group">
          <label>Organization *</label>
          <input type="text" name="organization" required placeholder="e.g., Local Art Museum" />
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea name="description" required rows={4} placeholder="Describe the opportunity, responsibilities, and what students will learn..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label>Type</label>
            <select name="type">
              <option value="IN_PERSON">In Person</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
          <div className="form-group">
            <label>Passion Area</label>
            <select name="passionArea">
              <option value="">Any</option>
              {["Art", "Music", "Writing", "Dance", "Theater", "Film", "Coding", "Science"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Location</label>
            <input type="text" name="location" placeholder="City, State" />
          </div>
          <div className="form-group">
            <label>Duration</label>
            <input type="text" name="duration" placeholder="e.g., 6 weeks" />
          </div>
          <div className="form-group">
            <label>Hours/Week</label>
            <input type="number" name="hoursPerWeek" min="1" max="40" />
          </div>
          <div className="form-group">
            <label>Age Range</label>
            <input type="text" name="ageRange" placeholder="e.g., 14-18" />
          </div>
          <div className="form-group">
            <label>Application Deadline</label>
            <input type="date" name="deadline" />
          </div>
          <div className="form-group">
            <label>Compensation</label>
            <input type="text" name="compensation" placeholder="e.g., $15/hr" />
          </div>
        </div>
        <div className="form-group">
          <label>Contact Name</label>
          <input type="text" name="contactName" />
        </div>
        <div className="form-group">
          <label>Contact Email</label>
          <input type="email" name="contactEmail" />
        </div>
        <input type="hidden" name="isPaid" value="false" />
        <input type="hidden" name="requirements" value="[]" />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="submit" className="button primary" disabled={loading}>
            {loading ? "Posting..." : "Post Opportunity"}
          </button>
          <button type="button" className="button secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function ApplyButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("listingId", listingId);
      await applyToInternship(formData);
      setApplied(true);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (applied) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", color: "#16a34a", fontWeight: 600 }}>
        Application submitted!
      </div>
    );
  }

  if (!open) {
    return (
      <button className="button primary" onClick={() => setOpen(true)}>
        Apply Now
      </button>
    );
  }

  return (
    <form action={handleSubmit} style={{ padding: 16, background: "var(--surface-alt)", borderRadius: "var(--radius-md)" }}>
      <h4 style={{ margin: "0 0 12px" }}>Your Application</h4>
      <div className="form-group">
        <label>Cover Letter / Why you&apos;re interested</label>
        <textarea name="coverLetter" rows={4} placeholder="Tell them why this opportunity excites you and what you'd bring..." />
      </div>
      <div className="form-group">
        <label>Portfolio URL</label>
        <input type="url" name="portfolioUrl" placeholder="https://..." />
      </div>
      <div className="form-group">
        <label>Resume URL (optional)</label>
        <input type="url" name="resumeUrl" placeholder="https://..." />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="button primary" disabled={loading}>
          {loading ? "Submitting..." : "Submit Application"}
        </button>
        <button type="button" className="button secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
