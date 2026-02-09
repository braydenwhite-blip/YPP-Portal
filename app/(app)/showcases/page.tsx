"use client";

import { useState } from "react";

export default function ShowcasesPage() {
  const [selectedShowcase, setSelectedShowcase] = useState<string | null>(null);

  // Sample data - in production, fetch from database
  const upcomingShowcases = [
    {
      id: "1",
      title: "Spring 2024 Passion Showcase",
      description: "Quarterly event where students present their passion projects to the community",
      date: "2024-04-15",
      location: "Virtual & Philadelphia Chapter",
      isVirtual: true,
      status: "REGISTRATION_OPEN",
      registrationDeadline: "2024-04-01",
      maxPresenters: 20,
      currentPresenters: 12,
      estimatedDuration: "2 hours",
      icon: "🌟"
    },
    {
      id: "2",
      title: "Arts & Creativity Showcase",
      description: "Special event focused on visual arts, music, and creative performances",
      date: "2024-05-10",
      location: "San Francisco Chapter",
      isVirtual: false,
      status: "UPCOMING",
      registrationDeadline: "2024-04-25",
      maxPresenters: 15,
      currentPresenters: 0,
      estimatedDuration: "3 hours",
      icon: "🎨"
    }
  ];

  const pastShowcases = [
    {
      id: "3",
      title: "Winter 2024 Passion Showcase",
      date: "2024-02-15",
      presentationCount: 18,
      views: 247,
      topVoted: {
        title: "Climate Action Documentary",
        student: "Maya R.",
        votes: 45
      }
    },
    {
      id: "4",
      title: "Fall 2023 Innovation Showcase",
      date: "2023-11-10",
      presentationCount: 22,
      views: 312,
      topVoted: {
        title: "Community Garden Project",
        student: "Carlos M.",
        votes: 52
      }
    }
  ];

  const myPresentations = [
    {
      id: "1",
      showcaseTitle: "Spring 2024 Passion Showcase",
      title: "Local Landscapes Portfolio",
      passionArea: "Visual Arts",
      description: "A collection of 15 watercolor paintings of Philadelphia landmarks",
      status: "REGISTERED",
      votes: 0
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Showcases</p>
          <h1 className="page-title">Passion Showcases</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🎭 Present Your Work</h3>
        <p>
          Quarterly showcase events where you can present your passion projects, get feedback,
          and celebrate achievements with the community. Both virtual and in-person options available!
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{myPresentations.length}</div>
          <div className="kpi-label">My Presentations</div>
        </div>
        <div className="card">
          <div className="kpi">{upcomingShowcases.length}</div>
          <div className="kpi-label">Upcoming Showcases</div>
        </div>
        <div className="card">
          <div className="kpi">0</div>
          <div className="kpi-label">Votes Received</div>
        </div>
        <div className="card">
          <div className="kpi">5</div>
          <div className="kpi-label">Showcases Attended</div>
        </div>
      </div>

      {/* Upcoming Showcases */}
      <div style={{ marginBottom: 40 }}>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Upcoming Showcases
        </div>
        <div className="grid two">
          {upcomingShowcases.map((showcase) => (
            <div key={showcase.id} className="card">
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {showcase.icon}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                <h3>{showcase.title}</h3>
                {showcase.status === "REGISTRATION_OPEN" && (
                  <span className="pill success">
                    Registration Open
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, marginBottom: 16 }}>
                {showcase.description}
              </p>

              {/* Event Details */}
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14
              }}>
                <div style={{ marginBottom: 6 }}>
                  📅 {new Date(showcase.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div style={{ marginBottom: 6 }}>
                  📍 {showcase.location}
                </div>
                <div style={{ marginBottom: 6 }}>
                  ⏱️ Estimated duration: {showcase.estimatedDuration}
                </div>
                {showcase.isVirtual && (
                  <div style={{ marginBottom: 6 }}>
                    💻 Virtual attendance available
                  </div>
                )}
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>Presenters</span>
                  <span>{showcase.currentPresenters} / {showcase.maxPresenters}</span>
                </div>
                <div style={{
                  width: "100%",
                  height: 8,
                  backgroundColor: "var(--bg-secondary)",
                  borderRadius: 4,
                  overflow: "hidden"
                }}>
                  <div style={{
                    width: `${(showcase.currentPresenters / showcase.maxPresenters) * 100}%`,
                    height: "100%",
                    backgroundColor: "var(--primary-color)",
                    transition: "width 0.3s"
                  }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  Registration deadline: {new Date(showcase.registrationDeadline).toLocaleDateString()}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                {showcase.status === "REGISTRATION_OPEN" ? (
                  <>
                    <button
                      onClick={() => setSelectedShowcase(showcase.id)}
                      className="button primary"
                      style={{ flex: 1 }}
                    >
                      Register to Present
                    </button>
                    <button className="button secondary">
                      View Details
                    </button>
                  </>
                ) : (
                  <>
                    <button className="button secondary" style={{ flex: 1 }}>
                      View Details
                    </button>
                    <button className="button secondary">
                      Notify Me
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My Presentations */}
      {myPresentations.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <div className="section-title" style={{ marginBottom: 20 }}>
            My Registered Presentations
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {myPresentations.map((presentation) => (
              <div key={presentation.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{presentation.title}</h3>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      {presentation.showcaseTitle} • {presentation.passionArea}
                    </div>
                  </div>
                  <span className="pill primary">
                    {presentation.status}
                  </span>
                </div>
                <p style={{ fontSize: 14, marginBottom: 16 }}>
                  {presentation.description}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button primary">
                    Upload Presentation
                  </button>
                  <button className="button secondary">
                    Edit Details
                  </button>
                  <button className="button secondary">
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Showcases */}
      <div>
        <div className="section-title" style={{ marginBottom: 20 }}>
          Past Showcases
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pastShowcases.map((showcase) => (
            <div key={showcase.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h3 style={{ marginBottom: 4 }}>{showcase.title}</h3>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    {new Date(showcase.date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                <span className="pill secondary">Completed</span>
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: 14, marginBottom: 12 }}>
                <span>🎬 {showcase.presentationCount} presentations</span>
                <span>👁️ {showcase.views} views</span>
              </div>
              <div style={{
                backgroundColor: "var(--bg-secondary)",
                padding: 12,
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 14
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  🏆 Top Voted: {showcase.topVoted.title}
                </div>
                <div style={{ color: "var(--text-secondary)" }}>
                  by {showcase.topVoted.student} • {showcase.topVoted.votes} votes
                </div>
              </div>
              <button className="button secondary">
                Watch Recordings
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Modal */}
      {selectedShowcase && (
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
            <h3>Register for Showcase</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Present your passion project to the community! Showcases are a great way to
              get feedback, inspire others, and celebrate your achievements.
            </p>
            <form action="/api/showcases/register" method="POST">
              <input type="hidden" name="showcaseId" value={selectedShowcase} />

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Presentation Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., My Photography Portfolio"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

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
                  <option>Service</option>
                  <option>Writing</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={4}
                  placeholder="What will you present? What makes it special?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Upload Preview (optional)
                </label>
                <input
                  type="file"
                  name="thumbnail"
                  accept="image/*"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Register
                </button>
                <button type="button" onClick={() => setSelectedShowcase(null)} className="button secondary">
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
