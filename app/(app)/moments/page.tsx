"use client";

import { useState } from "react";

export default function BreakthroughMomentsPage() {
  const [showAddMoment, setShowAddMoment] = useState(false);

  // Sample data - in production, fetch from database
  const moments = [
    {
      id: "1",
      studentName: "Sarah M.",
      studentPhoto: "👩‍🎨",
      passionArea: "Visual Arts",
      title: "Finally Understood Color Theory!",
      description: "After weeks of struggling with color mixing, it suddenly clicked when I was painting a sunset. I realized that warm and cool tones create depth, not just different colors. Now my paintings have so much more dimension!",
      date: "2024-03-15",
      celebrationCount: 24,
      isPublic: true,
      isRecognized: true
    },
    {
      id: "2",
      studentName: "Jake L.",
      studentPhoto: "🎸",
      passionArea: "Music",
      title: "Nailed the Complex Chord Progression",
      description: "I've been trying to play this jazz progression for 3 months. Today, my fingers just knew where to go without thinking. The muscle memory finally kicked in!",
      date: "2024-03-14",
      celebrationCount: 18,
      isPublic: true,
      isRecognized: false
    },
    {
      id: "3",
      studentName: "Maya R.",
      studentPhoto: "📸",
      passionArea: "Photography",
      title: "Captured the Perfect Golden Hour Shot",
      description: "I've been chasing golden hour lighting for months. Today everything aligned - the light, the composition, the moment. I finally got the shot I've been dreaming of.",
      date: "2024-03-12",
      celebrationCount: 31,
      isPublic: true,
      isRecognized: true
    },
    {
      id: "4",
      studentName: "Carlos M.",
      studentPhoto: "⚽",
      passionArea: "Sports",
      title: "Free Throw Form Breakthrough",
      description: "Coach kept telling me to 'follow through' but I didn't really get it. Then it clicked - it's about the wrist snap at the end. Now my free throw percentage jumped from 60% to 85%!",
      date: "2024-03-10",
      celebrationCount: 15,
      isPublic: true,
      isRecognized: false
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Breakthroughs</p>
          <h1 className="page-title">Breakthrough Moments</h1>
        </div>
        <button onClick={() => setShowAddMoment(true)} className="button primary">
          Share Your Moment
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>💡 Celebrate "Aha!" Moments</h3>
        <p>
          That magical moment when everything clicks. Share your breakthroughs to inspire
          others and get recognized for your progress!
        </p>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">4</div>
          <div className="kpi-label">Your Breakthrough Moments</div>
        </div>
        <div className="card">
          <div className="kpi">88</div>
          <div className="kpi-label">Total Celebrations</div>
        </div>
        <div className="card">
          <div className="kpi">2</div>
          <div className="kpi-label">Recognized by Mentors</div>
        </div>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Music</option>
            <option>Sports</option>
            <option>Photography</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Students</option>
            <option>My Moments</option>
            <option>My Chapter</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Recent</option>
            <option>Sort: Most Celebrated</option>
            <option>Sort: Recognized</option>
          </select>
        </div>
      </div>

      {/* Breakthrough Moments Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {moments.map((moment) => (
          <div key={moment.id} className="card">
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 48, flexShrink: 0 }}>
                {moment.studentPhoto}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{moment.title}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      {moment.studentName} • {moment.passionArea} • {new Date(moment.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                  {moment.isRecognized && (
                    <span className="pill success">
                      ✓ Mentor Recognized
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
                  {moment.description}
                </p>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button className="button secondary" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span>👏</span>
                    <span>Celebrate ({moment.celebrationCount})</span>
                  </button>
                  <button className="button secondary">
                    💬 Comment
                  </button>
                  <button className="button secondary">
                    📤 Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Moment Modal */}
      {showAddMoment && (
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
            <h3>Share Your Breakthrough Moment</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              What clicked for you? Share that "aha!" moment when everything suddenly made sense.
            </p>
            <form action="/api/moments/add" method="POST">
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
                  <option>Photography</option>
                  <option>Writing</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  What was your breakthrough? *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Finally mastered that difficult technique!"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Tell us about it *
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="What were you struggling with? What changed? How does it feel now?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Add photo or video (optional)
                </label>
                <input
                  type="file"
                  name="media"
                  accept="image/*,video/*"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" name="isPublic" defaultChecked />
                  <span style={{ fontSize: 14 }}>Share publicly (others can celebrate with you!)</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Share Breakthrough
                </button>
                <button type="button" onClick={() => setShowAddMoment(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty State */}
      {moments.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>💡</div>
          <h3 style={{ marginBottom: 12 }}>No Breakthrough Moments Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Share that magical moment when everything clicks! Your breakthroughs
            inspire others and deserve to be celebrated.
          </p>
          <button onClick={() => setShowAddMoment(true)} className="button primary">
            Share Your First Moment
          </button>
        </div>
      )}
    </div>
  );
}
