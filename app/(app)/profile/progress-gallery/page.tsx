"use client";

import { useState } from "react";

export default function ProgressGalleryPage() {
  const [showAddComparison, setShowAddComparison] = useState(false);

  /** Populated from the database when progress comparisons are stored. */
  const comparisons: Array<{
    id: string;
    title: string;
    passion: string;
    beforeDate: string;
    afterDate: string;
    beforeImage: string;
    afterImage: string;
    improvements: string[];
    skillsGained: string[];
    reflection: string;
    isPublic: boolean;
    likes: number;
    xpAwarded: number;
  }> = [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Progress</p>
          <h1 className="page-title">Progress Gallery</h1>
        </div>
        <button onClick={() => setShowAddComparison(true)} className="button primary">
          Add Before/After
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>📈 Visualize Your Growth</h3>
        <p>
          Document your journey with before and after comparisons. Seeing your progress
          visually is incredibly motivating and helps others learn from your experience!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{comparisons.length}</div>
          <div className="kpi-label">Total Comparisons</div>
        </div>
        <div className="card">
          <div className="kpi">{comparisons.filter(c => c.isPublic).length}</div>
          <div className="kpi-label">Public</div>
        </div>
        <div className="card">
          <div className="kpi">{comparisons.reduce((sum, c) => sum + c.likes, 0)}</div>
          <div className="kpi-label">Total Likes</div>
        </div>
        <div className="card">
          <div className="kpi">{comparisons.reduce((sum, c) => sum + c.xpAwarded, 0)}</div>
          <div className="kpi-label">XP Earned</div>
        </div>
      </div>

      {comparisons.length > 0 ? (
        <>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Sports</option>
            <option>Music</option>
            <option>Service</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Comparisons</option>
            <option>Public Only</option>
            <option>Private Only</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Recent</option>
            <option>Sort: Most Liked</option>
            <option>Sort: Oldest</option>
          </select>
        </div>
      </div>

      {/* Comparisons Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {comparisons.map((comp) => (
          <div key={comp.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <h3 style={{ marginBottom: 8 }}>{comp.title}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {comp.passion}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {comp.isPublic && (
                  <span className="pill success">Public</span>
                )}
                <button className="button secondary" style={{ padding: "4px 12px", fontSize: 13 }}>
                  ⋯
                </button>
              </div>
            </div>

            {/* Before/After Images */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div>
                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  marginBottom: 12
                }}>
                  <div style={{ fontSize: 80 }}>{comp.beforeImage}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Before</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {new Date(comp.beforeDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 12,
                  padding: 40,
                  textAlign: "center",
                  marginBottom: 12,
                  border: "2px solid var(--primary-color)"
                }}>
                  <div style={{ fontSize: 80 }}>{comp.afterImage}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>After</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {new Date(comp.afterDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Improvements */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                📊 Key Improvements
              </h4>
              <ul style={{ marginLeft: 20, fontSize: 14 }}>
                {comp.improvements.map((improvement, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>

            {/* Skills Gained */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                🎯 Skills Gained
              </h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {comp.skillsGained.map((skill, i) => (
                  <span key={i} className="pill secondary">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Reflection */}
            <div style={{
              backgroundColor: "var(--bg-secondary)",
              padding: 16,
              borderRadius: 8,
              marginBottom: 16
            }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                💭 Reflection
              </h4>
              <p style={{ fontSize: 14, fontStyle: "italic" }}>
                "{comp.reflection}"
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 12, fontSize: 14, color: "var(--text-secondary)" }}>
                {comp.isPublic && (
                  <span>❤️ {comp.likes} likes</span>
                )}
                <span>⭐ +{comp.xpAwarded} XP</span>
                <span>
                  📅 {Math.round((new Date(comp.afterDate).getTime() - new Date(comp.beforeDate).getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="button secondary">
                  📤 Share
                </button>
                <button className="button secondary">
                  ✏️ Edit
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
        </>
      ) : null}

      {/* Add Comparison Modal */}
      {showAddComparison && (
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
            <h3>Add Before/After Comparison</h3>
            <form style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., My Painting Progress"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Passion Area *
                </label>
                <select required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                  <option value="">Select passion</option>
                  <option>Visual Arts</option>
                  <option>Sports</option>
                  <option>Music</option>
                  <option>Service</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Before Date *
                  </label>
                  <input
                    type="date"
                    required
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    After Date *
                  </label>
                  <input
                    type="date"
                    required
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Before Image/Video *
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    required
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    After Image/Video *
                  </label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    required
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  What improved? (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Better technique&#10;Increased confidence&#10;More consistent results"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Reflection
                </label>
                <textarea
                  rows={3}
                  placeholder="What did you learn? What made the difference?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" />
                  <span style={{ fontSize: 14 }}>Make this comparison public</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Save Comparison
                </button>
                <button type="button" onClick={() => setShowAddComparison(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Empty State */}
      {comparisons.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>📊</div>
          <h3 style={{ marginBottom: 12 }}>No Progress Comparisons Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            Start documenting your journey! Create before/after comparisons to
            celebrate your growth and inspire others.
          </p>
          <button onClick={() => setShowAddComparison(true)} className="button primary">
            Add Your First Comparison
          </button>
        </div>
      )}
    </div>
  );
}
