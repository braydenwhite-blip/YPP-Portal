"use client";

import { useState } from "react";

export default function ResourceRequestsPage() {
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Sample data - in production, fetch from database
  const myRequests = [
    {
      id: "1",
      itemName: "Watercolor Paint Set (Professional Grade)",
      passionArea: "Visual Arts",
      projectName: "Local Landscapes Portfolio",
      estimatedCost: 85,
      reason: "Need professional-grade paints to complete portfolio for art school applications. Current student-grade paints aren't archival quality.",
      status: "APPROVED",
      requestedAt: "2024-03-10",
      reviewedAt: "2024-03-12",
      reviewNotes: "Approved! These will be available for pickup at the Philadelphia chapter next week."
    },
    {
      id: "2",
      itemName: "Canon T7 Camera (or similar DSLR)",
      passionArea: "Photography",
      projectName: null,
      estimatedCost: 450,
      reason: "Currently using phone camera. Need DSLR to learn manual controls and improve image quality for portfolio work.",
      status: "PENDING",
      requestedAt: "2024-03-14",
      reviewedAt: null,
      reviewNotes: null
    },
    {
      id: "3",
      itemName: "Guitar Strings (Medium Gauge)",
      passionArea: "Music",
      projectName: "Original Song Composition",
      estimatedCost: 15,
      reason: "Strings broke during practice. Need replacement to continue working on original compositions.",
      status: "FULFILLED",
      requestedAt: "2024-02-28",
      reviewedAt: "2024-03-01",
      reviewNotes: "Available at chapter. Picked up 3/2/24."
    }
  ];

  const statusColors: Record<string, string> = {
    PENDING: "#f59e0b",
    APPROVED: "#10b981",
    DENIED: "#ef4444",
    FULFILLED: "#6366f1"
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Resources</p>
          <h1 className="page-title">Resource Requests</h1>
        </div>
        <button onClick={() => setShowRequestForm(true)} className="button primary">
          Request Resources
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🛠️ Get What You Need</h3>
        <p>
          Need materials, equipment, or tools for your passion project? Submit a request
          explaining what you need and why. Chapter leaders review and fulfill requests based
          on availability and project needs.
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myRequests.length}</div>
          <div className="kpi-label">Total Requests</div>
        </div>
        <div className="card">
          <div className="kpi">{myRequests.filter(r => r.status === "APPROVED" || r.status === "FULFILLED").length}</div>
          <div className="kpi-label">Approved</div>
        </div>
        <div className="card">
          <div className="kpi">{myRequests.filter(r => r.status === "PENDING").length}</div>
          <div className="kpi-label">Pending Review</div>
        </div>
        <div className="card">
          <div className="kpi">${myRequests.filter(r => r.status === "FULFILLED").reduce((sum, r) => sum + r.estimatedCost, 0)}</div>
          <div className="kpi-label">Resources Received</div>
        </div>
      </div>

      {/* My Requests */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          My Requests
        </div>
        {myRequests.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {myRequests.map((request) => (
              <div key={request.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 8 }}>{request.itemName}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                      {request.passionArea} {request.projectName && `• ${request.projectName}`} • Requested {new Date(request.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="pill" style={{
                    backgroundColor: statusColors[request.status],
                    color: "white",
                    border: "none"
                  }}>
                    {request.status}
                  </span>
                </div>

                <div style={{
                  backgroundColor: "var(--bg-secondary)",
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 12
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                    Why I need this:
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                    {request.reason}
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    Estimated cost: <strong>${request.estimatedCost}</strong>
                  </div>
                </div>

                {request.reviewNotes && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: request.status === "APPROVED" || request.status === "FULFILLED"
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                    borderLeft: `3px solid ${statusColors[request.status]}`
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                      Chapter Response:
                    </div>
                    <div style={{ fontSize: 14 }}>
                      {request.reviewNotes}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🛠️</div>
            <h3 style={{ marginBottom: 12 }}>No Resource Requests Yet</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Need materials or equipment for your project? Submit a request!
            </p>
            <button onClick={() => setShowRequestForm(true)} className="button primary">
              Make Your First Request
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
            <h3>Request Resources</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Be specific about what you need and why it's essential for your project.
              Requests are reviewed weekly.
            </p>
            <form action="/api/resources/request" method="POST">
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
                  Related Project (optional)
                </label>
                <select
                  name="projectId"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">No specific project</option>
                  <option>Local Landscapes Portfolio</option>
                  <option>Guitar Composition Project</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  What do you need? *
                </label>
                <input
                  type="text"
                  name="itemName"
                  required
                  placeholder="e.g., Professional watercolor paint set"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Detailed Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  placeholder="Brand, model, specifications, quantity needed..."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Why do you need this? *
                </label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  placeholder="Explain how this will help your project and why it's necessary..."
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Estimated Cost
                </label>
                <input
                  type="number"
                  name="estimatedCost"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  Optional - helps with planning
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

      {/* Guidelines */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>💡 Request Guidelines</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Be Specific</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              "Professional watercolor set with cadmium colors" is better than "paint"
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Explain Why</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Show how this resource is essential for your project's success
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 14, marginBottom: 8 }}>Consider Alternatives</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Mention if you'd accept used equipment or alternative brands
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
