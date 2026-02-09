"use client";

import { useState } from "react";

export default function PracticeLogPage() {
  const [isLogging, setIsLogging] = useState(false);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Track</p>
          <h1 className="page-title">Practice Log</h1>
        </div>
        <button onClick={() => setIsLogging(true)} className="button primary">
          Log Practice Session
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📊 Track Your Practice</h3>
        <p>
          Consistency is key! Log your practice sessions to track progress,
          identify patterns, and build momentum. Even 10 minutes counts!
        </p>
      </div>

      {/* Stats */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">12</div>
          <div className="kpi-label">Sessions This Month</div>
        </div>
        <div className="card">
          <div className="kpi">180</div>
          <div className="kpi-label">Total Minutes</div>
        </div>
        <div className="card">
          <div className="kpi">7</div>
          <div className="kpi-label">Day Streak 🔥</div>
        </div>
      </div>

      {/* Log Form Modal */}
      {isLogging && (
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
          <div className="card" style={{ maxWidth: 500, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3>Log Practice Session</h3>
            <form action="/api/learn/practice/log" method="POST" style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  What did you practice? *
                </label>
                <select name="passionId" required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                  <option value="">Select passion area</option>
                  <option value="arts">Visual Arts</option>
                  <option value="sports">Sports</option>
                  <option value="music">Music</option>
                  <option value="writing">Writing</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Activity *
                </label>
                <input
                  type="text"
                  name="activity"
                  required
                  placeholder="e.g., Watercolor painting, Basketball drills"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  name="duration"
                  required
                  min="1"
                  placeholder="30"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  How did it go?
                </label>
                <select name="mood" style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                  <option value="GREAT">🌟 Great - I'm in the zone!</option>
                  <option value="GOOD">😊 Good - Making progress</option>
                  <option value="OK">😐 OK - Showed up</option>
                  <option value="FRUSTRATED">😤 Frustrated - Struggling</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Notes (optional)
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="What did you work on? Any breakthroughs or challenges?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Save Practice Log
                </button>
                <button type="button" onClick={() => setIsLogging(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <div className="section-title">Recent Practice Sessions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h4>Watercolor Painting</h4>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    Worked on landscape techniques
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8 }}>
                    😊 Felt good • Today • 45 minutes
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>
                  +15 XP
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
