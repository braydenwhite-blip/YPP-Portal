"use client";

import { useState } from "react";

export default function AskMentorPage() {
  const [showAskForm, setShowAskForm] = useState(false);

  // Sample data - in production, fetch from database
  const questions = [
    {
      id: "1",
      studentName: "Sarah M.",
      isAnonymous: false,
      passionArea: "Visual Arts",
      question: "How do I know when I'm ready to sell my artwork?",
      askedAt: "2024-03-14",
      status: "ANSWERED",
      views: 145,
      answers: [
        {
          mentorName: "Coach Rivera",
          mentorPhoto: "👨‍🏫",
          answer: "Great question! You're ready when: (1) You have a consistent style and quality across 10+ pieces, (2) You're comfortable explaining your process and inspiration, (3) You've gotten positive feedback from multiple sources. Start small - local markets, online platforms like Etsy, or consignment at local cafes. Don't wait for 'perfect' - your skills will grow as you sell!",
          helpful: 28,
          answeredAt: "2024-03-15"
        },
        {
          mentorName: "Ms. Chen",
          mentorPhoto: "👩‍🎨",
          answer: "Also consider: Can you reliably recreate your work if someone orders custom pieces? Do you have good photos of your art? Have you priced your work fairly (materials + time + experience)? I started selling after my third art show - that's when I felt confident.",
          helpful: 15,
          answeredAt: "2024-03-15"
        }
      ]
    },
    {
      id: "2",
      studentName: "Anonymous",
      isAnonymous: true,
      passionArea: "Music",
      question: "I practice every day but don't feel like I'm improving. Is this normal?",
      askedAt: "2024-03-12",
      status: "ANSWERED",
      views: 203,
      answers: [
        {
          mentorName: "Alex Rivera",
          mentorPhoto: "🎸",
          answer: "Totally normal! This is called a 'plateau' - everyone hits them. Here's what helps: (1) Record yourself weekly to track small changes you can't feel day-to-day, (2) Change up your practice routine - if you usually play scales, try songs instead, (3) Take a week break - seriously, your brain needs rest to consolidate skills. Progress isn't linear!",
          helpful: 42,
          answeredAt: "2024-03-13"
        }
      ]
    },
    {
      id: "3",
      studentName: "Carlos M.",
      isAnonymous: false,
      passionArea: "Service",
      question: "How do I start a nonprofit or community project as a high schooler?",
      askedAt: "2024-03-10",
      status: "ANSWERED",
      views: 87,
      answers: [
        {
          mentorName: "Maya Johnson",
          mentorPhoto: "🌱",
          answer: "Start small and build! (1) Identify a specific problem in your community, (2) Find 2-3 other passionate students, (3) Partner with an existing nonprofit or school club first - easier than creating a new entity, (4) Start with one pilot event or project, (5) Document everything - photos, impact metrics, testimonials. I started with one community garden plot, now we have 20 plots serving 50 families!",
          helpful: 31,
          answeredAt: "2024-03-11"
        }
      ]
    },
    {
      id: "4",
      studentName: "Anonymous",
      isAnonymous: true,
      passionArea: "General",
      question: "What if I lose interest in my passion?",
      askedAt: "2024-03-08",
      status: "PENDING",
      views: 52,
      answers: []
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Ask a Mentor</h1>
        </div>
        <button onClick={() => setShowAskForm(true)} className="button primary">
          Ask a Question
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🙋 Community Q&A</h3>
        <p>
          Get advice from experienced mentors and instructors. Browse answered questions
          or ask your own. All questions help the community learn!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{questions.length}</div>
          <div className="kpi-label">Total Questions</div>
        </div>
        <div className="card">
          <div className="kpi">{questions.filter(q => q.status === "ANSWERED").length}</div>
          <div className="kpi-label">Answered</div>
        </div>
        <div className="card">
          <div className="kpi">
            {questions.reduce((sum, q) => sum + q.answers.length, 0)}
          </div>
          <div className="kpi-label">Total Answers</div>
        </div>
        <div className="card">
          <div className="kpi">
            {questions.reduce((sum, q) => sum + q.views, 0)}
          </div>
          <div className="kpi-label">Total Views</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Music</option>
            <option>Service</option>
            <option>Sports</option>
            <option>General</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Questions</option>
            <option>Answered Only</option>
            <option>Unanswered</option>
            <option>My Questions</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Recent</option>
            <option>Sort: Most Helpful</option>
            <option>Sort: Most Viewed</option>
          </select>
        </div>
      </div>

      {/* Questions Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {questions.map((question) => (
          <div key={question.id} className="card">
            <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>
                {question.isAnonymous ? "👤" : "👨‍🎓"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <h3 style={{ marginBottom: 8 }}>{question.question}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      Asked by {question.isAnonymous ? "Anonymous" : question.studentName} • {question.passionArea} • {new Date(question.askedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                    <span>👁️ {question.views}</span>
                    <span className={`pill ${question.status === "ANSWERED" ? "success" : "warning"}`}>
                      {question.status}
                    </span>
                  </div>
                </div>

                {/* Answers */}
                {question.answers.length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    {question.answers.map((answer, i) => (
                      <div key={i} style={{
                        backgroundColor: "var(--bg-secondary)",
                        padding: 16,
                        borderRadius: 8,
                        marginBottom: 12,
                        borderLeft: "3px solid var(--primary-color)"
                      }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                          <div style={{ fontSize: 32 }}>
                            {answer.mentorPhoto}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {answer.mentorName}
                              <span style={{
                                marginLeft: 8,
                                fontSize: 12,
                                padding: "2px 8px",
                                backgroundColor: "var(--primary-color)",
                                color: "white",
                                borderRadius: 4
                              }}>
                                MENTOR
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                              Answered {new Date(answer.answeredAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                          {answer.answer}
                        </p>
                        <button className="button secondary" style={{ fontSize: 13, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span>👍</span>
                          <span>Helpful ({answer.helpful})</span>
                        </button>
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
                    ⏳ Awaiting mentor answer...
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ask Question Modal */}
      {showAskForm && (
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
            <h3>Ask a Mentor</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Ask any question about your passion journey. Mentors typically respond within 1-2 days.
            </p>
            <form action="/api/mentor/ask" method="POST">
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Passion Area (optional)
                </label>
                <select
                  name="passionId"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">General question</option>
                  <option>Visual Arts</option>
                  <option>Music</option>
                  <option>Sports</option>
                  <option>Service</option>
                  <option>Writing</option>
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
                  placeholder="E.g., 'How do I stay motivated when progress feels slow?' or 'What's the best way to get feedback on my work?'"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" name="isAnonymous" />
                  <span style={{ fontSize: 14 }}>Ask anonymously</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Ask Question
                </button>
                <button type="button" onClick={() => setShowAskForm(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
