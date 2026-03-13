"use client";

import { useState } from "react";
import {
  approveMilestone,
  approveProjectLaunch,
  postUpdate,
  requestResource,
  submitMilestone,
  submitPitchFeedback,
  submitProjectLaunch,
  updateProjectShowcase,
} from "@/lib/incubator-actions";

function InlineError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{ background: "#fee2e2", color: "#dc2626", padding: 8, borderRadius: 8, marginBottom: 8, fontSize: 12 }}>
      {message}
    </div>
  );
}

export function SubmitMilestoneForm({
  projectId,
  milestoneId,
  requiresMentorApproval,
}: {
  projectId: string;
  milestoneId: string;
  requiresMentorApproval: boolean;
}) {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError("");
    try {
      await submitMilestone(projectId, milestoneId, formData);
      setDone(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not submit milestone");
    }
  }

  if (done) {
    return (
      <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 12, fontSize: 12 }}>
        {requiresMentorApproval ? "Submitted for mentor approval." : "Milestone completed."}
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <InlineError message={error} />
      <textarea
        name="submissionNote"
        rows={3}
        className="input"
        style={{ width: "100%", resize: "vertical", marginBottom: 8 }}
        placeholder="Write a short update explaining what you completed."
      />
      <input
        name="artifactUrls"
        className="input"
        style={{ width: "100%", marginBottom: 8 }}
        placeholder="Optional links to files, demos, slides, or screenshots (comma-separated)"
      />
      <button type="submit" className="button primary small">
        {requiresMentorApproval ? "Submit for Review" : "Mark Milestone Complete"}
      </button>
    </form>
  );
}

export function ApproveMilestoneButton({ projectId, milestoneId }: { projectId: string; milestoneId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      await approveMilestone(projectId, milestoneId);
      window.location.reload();
    } catch (approvalError: any) {
      setError(approvalError?.message || "Could not approve milestone");
      setLoading(false);
    }
  }

  return (
    <div>
      <InlineError message={error} />
      <button onClick={handleApprove} disabled={loading} className="button primary small">
        {loading ? "Approving..." : "Approve Milestone"}
      </button>
    </div>
  );
}

export function PostUpdateForm({ projectId }: { projectId: string; currentPhase: string }) {
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    try {
      await postUpdate(projectId, formData);
      setPosted(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not post update");
    }
  }

  if (posted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 10, fontSize: 13 }}>
        Update posted. Your studio history is now current.
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <InlineError message={error} />
      <input
        name="title"
        required
        placeholder="Update title"
        className="input"
        style={{ width: "100%", marginBottom: 8 }}
      />
      <textarea
        name="content"
        required
        rows={3}
        placeholder="What changed this week, what did you learn, and what is blocked?"
        className="input"
        style={{ width: "100%", resize: "vertical", marginBottom: 8 }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input
          name="hoursSpent"
          type="number"
          step="0.5"
          min="0"
          placeholder="Hours spent"
          className="input"
          style={{ width: "100%" }}
        />
        <input
          name="mediaUrls"
          placeholder="Links to media (comma-separated)"
          className="input"
          style={{ width: "100%" }}
        />
      </div>
      <button type="submit" className="button primary small">Post Update</button>
    </form>
  );
}

export function PitchFeedbackForm({ projectId }: { projectId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    try {
      await submitPitchFeedback(projectId, formData);
      setSubmitted(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not submit feedback");
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 10, fontSize: 13 }}>
        Feedback submitted.
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <InlineError message={error} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 8 }}>
        {[
          ["clarityScore", "Clarity"],
          ["passionScore", "Passion"],
          ["executionScore", "Execution"],
          ["impactScore", "Impact"],
        ].map(([name, label]) => (
          <div key={name}>
            <label style={{ display: "block", fontSize: 11, marginBottom: 4, color: "#64748b" }}>{label}</label>
            <select name={name} className="input" style={{ width: "100%" }}>
              <option value="">--</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <textarea name="strengths" rows={2} className="input" style={{ width: "100%", resize: "vertical", marginBottom: 8 }} placeholder="What is already strong?" />
      <textarea name="improvements" rows={2} className="input" style={{ width: "100%", resize: "vertical", marginBottom: 8 }} placeholder="What should improve next?" />
      <textarea name="encouragement" rows={2} className="input" style={{ width: "100%", resize: "vertical", marginBottom: 8 }} placeholder="Leave encouraging words." />
      <button type="submit" className="button primary small">Submit Feedback</button>
    </form>
  );
}

export function LaunchStudioForm({
  project,
  isOwner,
}: {
  project: any;
  isOwner: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setSaved(false);
    setError("");
    try {
      await updateProjectShowcase(project.id, formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not save launch draft");
    }
  }

  return (
    <form action={handleSubmit}>
      <InlineError message={error} />
      {saved && (
        <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 10, marginBottom: 10, fontSize: 12 }}>
          Launch draft saved.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <input name="launchTitle" defaultValue={project.launchTitle || ""} className="input" placeholder="Launch title" disabled={!isOwner} />
        <input name="launchTagline" defaultValue={project.launchTagline || ""} className="input" placeholder="One-line tagline" disabled={!isOwner} />
      </div>
      <textarea
        name="launchSummary"
        defaultValue={project.launchSummary || ""}
        rows={3}
        className="input"
        style={{ width: "100%", resize: "vertical", marginBottom: 8 }}
        placeholder="What is this project and why should someone care?"
        disabled={!isOwner}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <textarea
          name="problemStatement"
          defaultValue={project.problemStatement || ""}
          rows={3}
          className="input"
          style={{ width: "100%", resize: "vertical" }}
          placeholder="What problem does it solve?"
          disabled={!isOwner}
        />
        <textarea
          name="solutionSummary"
          defaultValue={project.solutionSummary || ""}
          rows={3}
          className="input"
          style={{ width: "100%", resize: "vertical" }}
          placeholder="How does it solve it?"
          disabled={!isOwner}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <input name="targetAudience" defaultValue={project.targetAudience || ""} className="input" placeholder="Who is this for?" disabled={!isOwner} />
        <input name="buildHighlights" defaultValue={(project.buildHighlights || []).join(", ")} className="input" placeholder="Key highlights (comma-separated)" disabled={!isOwner} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <input name="demoUrl" defaultValue={project.demoUrl || ""} className="input" placeholder="Demo URL" disabled={!isOwner} />
        <input name="repositoryUrl" defaultValue={project.repositoryUrl || ""} className="input" placeholder="Repository URL" disabled={!isOwner} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <input name="waitlistUrl" defaultValue={project.waitlistUrl || ""} className="input" placeholder="Signup or waitlist URL" disabled={!isOwner} />
        <input name="launchGalleryUrls" defaultValue={(project.launchGalleryUrls || []).join(", ")} className="input" placeholder="Image/video URLs (comma-separated)" disabled={!isOwner} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <input name="pitchVideoUrl" defaultValue={project.pitchVideoUrl || ""} className="input" placeholder="Pitch video URL" disabled={!isOwner} />
        <input name="pitchDeckUrl" defaultValue={project.pitchDeckUrl || ""} className="input" placeholder="Pitch deck URL" disabled={!isOwner} />
        <input name="finalShowcaseUrl" defaultValue={project.finalShowcaseUrl || ""} className="input" placeholder="Final showcase URL" disabled={!isOwner} />
      </div>
      {isOwner && <button type="submit" className="button primary small">Save Launch Draft</button>}
    </form>
  );
}

export function SubmitLaunchButton({ projectId, launchStatus }: { projectId: string; launchStatus: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      await submitProjectLaunch(projectId);
      window.location.reload();
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not submit launch");
      setLoading(false);
    }
  }

  return (
    <div>
      <InlineError message={error} />
      <button onClick={handleSubmit} disabled={loading || launchStatus === "APPROVED"} className="button primary small">
        {loading ? "Submitting..." : launchStatus === "SUBMITTED" ? "Launch Submitted" : launchStatus === "APPROVED" ? "Launch Approved" : "Submit Launch for Review"}
      </button>
    </div>
  );
}

export function ApproveLaunchButton({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      await approveProjectLaunch(projectId);
      window.location.reload();
    } catch (approvalError: any) {
      setError(approvalError?.message || "Could not approve launch");
      setLoading(false);
    }
  }

  return (
    <div>
      <InlineError message={error} />
      <button onClick={handleApprove} disabled={loading} className="button primary small">
        {loading ? "Publishing..." : "Approve Public Launch"}
      </button>
    </div>
  );
}

export function ResourceRequestForm({ projectId }: { projectId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    try {
      formData.set("incubatorProjectId", projectId);
      await requestResource(formData);
      setSubmitted(true);
      setTimeout(() => window.location.reload(), 500);
    } catch (submissionError: any) {
      setError(submissionError?.message || "Could not submit request");
    }
  }

  if (submitted) {
    return (
      <div style={{ padding: 10, background: "#dcfce7", color: "#166534", borderRadius: 10, fontSize: 12 }}>
        Resource request submitted.
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <InlineError message={error} />
      <input name="itemName" className="input" style={{ width: "100%", marginBottom: 8 }} placeholder="What do you need?" />
      <textarea name="description" rows={2} className="input" style={{ width: "100%", resize: "vertical", marginBottom: 8 }} placeholder="Describe the item or support." />
      <textarea name="reason" rows={2} className="input" style={{ width: "100%", resize: "vertical", marginBottom: 8 }} placeholder="Why will this help the project launch?" />
      <input name="estimatedCost" type="number" min="0" step="0.01" className="input" style={{ width: "100%", marginBottom: 8 }} placeholder="Estimated cost (optional)" />
      <button type="submit" className="button secondary small">Request Support</button>
    </form>
  );
}
