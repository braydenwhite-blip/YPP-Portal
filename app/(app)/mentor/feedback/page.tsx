"use client";

import { useState } from "react";

export default function MentorFeedbackPage() {
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Sample data - in production, fetch from database
  const myRequests = [
    {
      id: "1",
      passionArea: "Visual Arts",
      question: "How can I improve the composition in my landscape paintings?",
      submittedAt: "2024-03-10",
      status: "ANSWERED",
      responses: [
        {
          mentorName: "Coach Rivera",
          mentorPhoto: "👨‍🏫",
          feedback: "Great progress! Your use of color is strong. For composition, try using the rule of thirds - place your focal point at the intersection points. Also, consider adding more depth by layering foreground, midground, and background elements.",
          videoUrl: "https://example.com/feedback-video",
          respondedAt: "2024-03-11",
          isHelpful: true
        }
      ]
    },
    {
      id: "2",
      passionArea: "Music",
      question: "Struggling with tempo consistency in my guitar practice. Any tips?",
      submittedAt: "2024-03-14",
      status: "PENDING",
      responses: []
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Mentor Feedback Portal</h1>
        </div>
        <button onClick={() => setShowRequestForm(true)} className="button primary">
          Request Feedback
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>💬 Get Expert Feedback</h3>
        <p>
          Submit your work for review by experienced mentors and instructors. Get personalized
          feedback to level up your skills. Responses typically within 2-3 days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myRequests.length}</div>
          <div className="kpi-label">Total Requests</div>
        </div>
        <div className="card">
          <div className="kpi">{myRequests.filter(r => r.status === "ANSWERED").length}</div>
          <div className="kpi-label">Answered</div>
        </div>
        <div className="card">
          <div className="kpi">{myRequests.filter(r => r.status === "PENDING").length}</div>
          <div className="kpi-label">Pending</div>
        </div>
        <div className="card">
          <div className="kpi">1.5</div>
          <div className="kpi-label">Avg Response Days</div>
        </div>
      </div>

      {/* My Requests */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          My Feedback Requests
        </div>
        {myRequests.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {myRequests.map((request) => (
              <div key={request.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ marginBottom: 8 }}>{request.question}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      {request.passionArea} • Submitted {new Date(request.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <span className={`pill ${request.status === "ANSWERED" ? "success" : "warning"}`}>
                    {request.status}
                  </span>
                </div>

                {/* Responses */}
                {request.responses.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    {request.responses.map((response, i) => (
                      <div key={i} style={{
                        backgroundColor: "var(--bg-secondary)",
                        padding: 16,
                        borderRadius: 8,
                        marginBottom: 12,
                        borderLeft: "3px solid var(--primary-color)"
                      }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 32 }}>
                            {response.mentorPhoto}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {response.mentorName}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                              Responded {new Date(response.respondedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                          {response.feedback}
                        </p>
                        {response.videoUrl && (
                          <button className="button secondary" style={{ marginBottom: 12 }}>
                            📹 Watch Video Feedback
                          </button>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="button secondary" style={{ fontSize: 13, padding: "4px 12px" }}>
                            👍 Helpful
                          </button>
                          <button className="button secondary" style={{ fontSize: 13, padding: "4px 12px" }}>
                            💬 Follow-up Question
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: "var(--bg-secondary)",
                    padding: 16,
                    borderRadius: 8,
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    marginTop: 12
                  }}>
                    ⏳ Waiting for mentor response...
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>💬</div>
            <h3 style={{ marginBottom: 12 }}>No Feedback Requests Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Get personalized feedback from experienced mentors on your work!
            </p>
            <button onClick={() => setShowRequestForm(true)} className="button primary">
              Request Your First Feedback
            </button>
          </div>
        )}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3>Request Mentor Feedback</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Share your work and ask specific questions. Mentors will provide detailed feedback
              within 2-3 days.
            </p>
            <form action="/api/mentor/feedback/request" method="POST">
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Passion Area *
                </label>
                <select
                  name="passionId"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">Select passion</option>
                  <option>Visual Arts</option>
                  <option>Music</option>
                  <option>Sports</option>
                  <option>Writing</option>
                  <option>Photography</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Related Project (optional)
                </label>
                <select
                  name="projectId"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">No project</option>
                  <option>Local Landscapes Portfolio</option>
                  <option>Guitar Composition Project</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Your Question *
                </label>
                <textarea
                  name="question"
                  required
                  rows={4}
                  placeholder="Be specific! E.g., 'How can I improve my color mixing?' or 'Is my composition effective?'"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Upload Work Samples *
                </label>
                <input
                  type="file"
                  name="samples"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Upload 1-5 examples of your work (images, videos, audio, or PDFs)
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Submit Request
                </button>
                <button type="button" onClick={() => setShowRequestForm(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>💡 Getting the Best Feedback</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Be Specific</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Ask targeted questions like "How's my composition?" instead of "What do you think?"
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Show Your Work</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Include 3-5 examples so mentors can see patterns and give better advice
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Context Helps</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Mention what you've tried and what you're struggling with specifically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
