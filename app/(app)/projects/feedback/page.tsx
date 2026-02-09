"use client";

import { useState } from "react";

export default function ProjectFeedbackPage() {
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Sample data - in production, fetch from database
  const myFeedbackCycles = [
    {
      id: "1",
      projectName: "Local Landscapes Portfolio",
      passionArea: "Visual Arts",
      milestone: "First 5 Paintings Complete",
      workSampleUrl: "https://example.com/portfolio-draft.pdf",
      description: "Completed my first 5 landscape paintings. Looking for feedback on composition, color choices, and technical execution before moving to the next series.",
      requestedFrom: "MENTOR",
      status: "COMPLETED",
      requestedAt: "2024-03-01",
      feedbackReceived: [
        {
          id: "1",
          reviewerName: "Ms. Chen (Art Mentor)",
          strengths: "Your use of light and shadow is exceptional, especially in the mountain scenes. The color palette shows maturity - muted earth tones create a calm, professional feel.",
          improvements: "Consider varying your compositions more. 3 of 5 paintings use similar horizontal layouts. Try vertical orientations and different focal point placements.",
          suggestions: "Study Turner's watercolor techniques for skies. Your skies could have more depth. Also, work on foreground detail - currently backgrounds are stronger than foregrounds.",
          encouragement: "This is portfolio-ready work for a high schooler. You're developing a signature style early, which is wonderful. Keep pushing your technical skills!",
          videoUrl: "https://example.com/feedback-video-1.mp4",
          respondedAt: "2024-03-05"
        },
        {
          id: "2",
          reviewerName: "Alex (Peer Reviewer)",
          strengths: "I love the mood in these paintings. They feel peaceful and real. Your brush control is really good.",
          improvements: "The trees in painting #3 look a bit flat compared to everything else.",
          suggestions: "Maybe try adding some wildlife or people to give scale? Just an idea!",
          encouragement: "These are amazing! Way better than anything I could do. Can't wait to see the next series!",
          videoUrl: null,
          respondedAt: "2024-03-04"
        }
      ]
    },
    {
      id: "2",
      projectName: "Original Song Composition",
      passionArea: "Music",
      milestone: "Demo Recording of 3 Songs",
      workSampleUrl: "https://soundcloud.com/demo-123",
      description: "Recorded rough demos of 3 original songs. Need feedback on song structure, melody, lyrics, and production quality before recording final versions.",
      requestedFrom: "INSTRUCTOR",
      status: "PENDING",
      requestedAt: "2024-03-12",
      feedbackReceived: []
    },
    {
      id: "3",
      projectName: null,
      passionArea: "Photography",
      milestone: "Portrait Series Practice",
      workSampleUrl: null,
      description: "Practicing portrait photography with natural lighting. Will submit 10 best photos once I finish the series.",
      requestedFrom: "PEER",
      status: "IN_PROGRESS",
      requestedAt: "2024-03-10",
      feedbackReceived: []
    }
  ];

  const statusColors: Record<string, string> = {
    IN_PROGRESS: "#6366f1",
    PENDING: "#f59e0b",
    COMPLETED: "#10b981"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Feedback</p>
          <h1 className="page-title">Project Feedback</h1>
        </div>
        <button onClick={() => setShowRequestForm(true)} className="button primary">
          Request Feedback
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🔄 Improve Through Feedback</h3>
        <p>
          Share your work at key milestones and get constructive feedback from mentors,
          instructors, or peers. Use their insights to refine your projects and grow your skills.
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myFeedbackCycles.length}</div>
          <div className="kpi-label">Feedback Requests</div>
        </div>
        <div className="card">
          <div className="kpi">{myFeedbackCycles.filter(f => f.status === "COMPLETED").length}</div>
          <div className="kpi-label">Completed</div>
        </div>
        <div className="card">
          <div className="kpi">{myFeedbackCycles.reduce((sum, f) => sum + f.feedbackReceived.length, 0)}</div>
          <div className="kpi-label">Total Responses</div>
        </div>
        <div className="card">
          <div className="kpi">{myFeedbackCycles.filter(f => f.status === "PENDING").length}</div>
          <div className="kpi-label">Awaiting Review</div>
        </div>
      </div>

      {/* Active Feedback Cycles */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          My Feedback Requests
        </div>
        {myFeedbackCycles.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {myFeedbackCycles.map((cycle) => (
              <div key={cycle.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 8 }}>
                      {cycle.projectName || "Practice Work"}
                    </h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {cycle.passionArea} • {cycle.milestone}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Requested from: <strong>{cycle.requestedFrom}</strong> • {new Date(cycle.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill" style={{
                    backgroundColor: statusColors[cycle.status],
                    color: "white",
                    border: "none"
                  }}>
                    {cycle.status.replace("_", " ")}
                  </span>
                </div>

                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                    What I'm looking for feedback on:
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                    {cycle.description}
                  </p>
                  {cycle.workSampleUrl && (
                    <a href={cycle.workSampleUrl} target="_blank" className="button secondary" style={{ fontSize: 13 }}>
                      📎 View Work Sample
                    </a>
                  )}
                </div>

                {/* Feedback Responses */}
                {cycle.feedbackReceived.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>
                      Feedback Received ({cycle.feedbackReceived.length})
                    </div>
                    {cycle.feedbackReceived.map((feedback) => (
                      <div key={feedback.id} style={{
                        border: "1px solid var(--border-color)",
                        borderRadius: 8,
                        padding: 16,
                        marginBottom: 12
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontWeight: 600 }}>{feedback.reviewerName}</div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                            {new Date(feedback.respondedAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 4 }}>
                              ✓ Strengths
                            </div>
                            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                              {feedback.strengths}
                            </p>
                          </div>

                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 4 }}>
                              ⚠ Areas to Improve
                            </div>
                            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                              {feedback.improvements}
                            </p>
                          </div>

                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 4 }}>
                              💡 Suggestions
                            </div>
                            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                              {feedback.suggestions}
                            </p>
                          </div>

                          <div style={{
                            backgroundColor: "rgba(16, 185, 129, 0.1)",
                            padding: 12,
                            borderRadius: 6,
                            borderLeft: "3px solid #10b981"
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                              💪 Encouragement
                            </div>
                            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                              {feedback.encouragement}
                            </p>
                          </div>

                          {feedback.videoUrl && (
                            <a href={feedback.videoUrl} target="_blank" className="button secondary" style={{ fontSize: 13 }}>
                              📹 Watch Video Feedback
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center",
                    padding: 20,
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "var(--text-secondary)"
                  }}>
                    {cycle.status === "PENDING" ? "⏳ Waiting for reviewer to respond..." : "📝 Upload your work sample to receive feedback"}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🔄</div>
            <h3 style={{ marginBottom: 12 }}>No Feedback Requests Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Ready to get feedback on your work? Share your progress and get constructive input!
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
            <h3>Request Feedback</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Share your work and get structured feedback to help you improve.
            </p>
            <form action="/api/projects/feedback/request" method="POST">
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
                  <option>Photography</option>
                  <option>Writing</option>
                  <option>Sports</option>
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
                  <option value="">No specific project</option>
                  <option>Local Landscapes Portfolio</option>
                  <option>Original Song Composition</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Milestone/Stage *
                </label>
                <input
                  type="text"
                  name="milestone"
                  required
                  placeholder="e.g., First draft complete, Demo recording finished"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  What feedback are you looking for? *
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="Be specific about what you want feedback on. What aspects should the reviewer focus on?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Who should review this? *
                </label>
                <select
                  name="requestedFrom"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">Select reviewer type</option>
                  <option value="MENTOR">Mentor (Expert feedback)</option>
                  <option value="INSTRUCTOR">Instructor (Detailed technical review)</option>
                  <option value="PEER">Peer (Fresh perspective from classmates)</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Work Sample URL
                </label>
                <input
                  type="url"
                  name="workSampleUrl"
                  placeholder="Link to your work (Google Drive, SoundCloud, YouTube, etc.)"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Share a link to your work. Make sure permissions are set so reviewers can view it.
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Submit for Review
                </button>
                <button type="button" onClick={() => setShowRequestForm(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>💡 Getting Great Feedback</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Be Specific</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              "I need feedback on composition and color" is better than "tell me what you think"
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Choose the Right Reviewer</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Mentors for expert advice, instructors for technical details, peers for fresh eyes
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Share Context</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Explain what you're trying to achieve and what you're struggling with
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Act on Feedback</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Try implementing suggestions and document what worked for your growth
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
