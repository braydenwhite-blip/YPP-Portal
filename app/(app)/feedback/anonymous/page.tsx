import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AnonymousFeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Feedback</p>
          <h1 className="page-title">Anonymous Feedback</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🔒 Share Your Thoughts Anonymously</h3>
        <p>
          Your feedback helps us improve. This form is completely anonymous - we won't know who submitted it.
          Please be honest and constructive.
        </p>
      </div>

      <div className="card">
        <form action="/api/feedback/submit-anonymous" method="POST">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Feedback Category *
            </label>
            <select
              name="category"
              required
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            >
              <option value="">Select a category</option>
              <option value="COURSE">Course/Curriculum</option>
              <option value="INSTRUCTOR">Instructor</option>
              <option value="PLATFORM">Portal/Platform</option>
              <option value="EVENTS">Events</option>
              <option value="ADMIN">Administration</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Feedback Type *
            </label>
            <select
              name="type"
              required
              style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
            >
              <option value="">Select type</option>
              <option value="SUGGESTION">Suggestion</option>
              <option value="COMPLAINT">Complaint</option>
              <option value="PRAISE">Praise</option>
              <option value="BUG">Bug Report</option>
              <option value="SAFETY">Safety Concern</option>
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
              Your Feedback *
            </label>
            <textarea
              name="content"
              required
              rows={10}
              placeholder="Please be specific and constructive. Your identity will remain anonymous."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: 6,
                fontFamily: "inherit",
                resize: "vertical"
              }}
            />
          </div>

          <div style={{
            marginBottom: 16,
            padding: 12,
            backgroundColor: "var(--accent-bg)",
            borderRadius: 6,
            fontSize: 13
          }}>
            ℹ️ This feedback is completely anonymous. We cannot respond directly to you.
            If you need a response, please use the regular feedback form instead.
          </div>

          <button type="submit" className="button primary">
            Submit Anonymous Feedback
          </button>
        </form>
      </div>
    </div>
  );
}
