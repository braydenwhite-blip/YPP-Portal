"use client";

import { useState } from "react";

export default function ProjectTrackerPage() {
  const [showNewProject, setShowNewProject] = useState(false);

  // Sample projects - in production, fetch from database
  const projects = [
    {
      id: "1",
      title: "Landscape Photography Portfolio",
      passion: "Visual Arts",
      status: "IN_PROGRESS",
      startDate: "2024-01-10",
      targetEndDate: "2024-04-15",
      description: "Create a comprehensive portfolio of local landscape photography",
      thumbnailUrl: "📷",
      visibility: "PUBLIC",
      progress: 65,
      totalMilestones: 8,
      completedMilestones: 5,
      tags: ["photography", "nature", "portfolio"]
    },
    {
      id: "2",
      title: "Build a Custom Guitar",
      passion: "Music",
      status: "IN_PROGRESS",
      startDate: "2024-02-01",
      targetEndDate: "2024-06-30",
      description: "Design and build an electric guitar from scratch",
      thumbnailUrl: "🎸",
      visibility: "MENTORS_ONLY",
      progress: 30,
      totalMilestones: 12,
      completedMilestones: 4,
      tags: ["woodworking", "music", "craftsmanship"]
    },
    {
      id: "3",
      title: "Youth Climate Action Campaign",
      passion: "Service",
      status: "PLANNING",
      startDate: "2024-03-01",
      targetEndDate: "2024-08-01",
      description: "Organize community events to raise awareness about climate change",
      thumbnailUrl: "🌍",
      visibility: "PUBLIC",
      progress: 10,
      totalMilestones: 10,
      completedMilestones: 1,
      tags: ["activism", "environment", "community"]
    },
    {
      id: "4",
      title: "Short Film Production",
      passion: "Entertainment",
      status: "COMPLETED",
      startDate: "2023-10-15",
      targetEndDate: "2024-01-20",
      description: "Write, direct, and produce a 15-minute short film",
      thumbnailUrl: "🎬",
      visibility: "PUBLIC",
      progress: 100,
      totalMilestones: 15,
      completedMilestones: 15,
      tags: ["filmmaking", "storytelling", "creative"]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLANNING": return "#6366f1";
      case "IN_PROGRESS": return "#f59e0b";
      case "ON_HOLD": return "#64748b";
      case "COMPLETED": return "#10b981";
      case "CANCELLED": return "#ef4444";
      default: return "var(--primary-color)";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ");
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Projects</p>
          <h1 className="page-title">My Projects</h1>
        </div>
        <button onClick={() => setShowNewProject(true)} className="button primary">
          Start New Project
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>🎯 Long-Term Project Tracker</h3>
        <p>
          Plan, track, and showcase your passion projects. Break down big goals into
          achievable milestones and document your journey from start to finish.
        </p>
      </div>

      {/* Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">{projects.filter(p => p.status === "IN_PROGRESS").length}</div>
          <div className="kpi-label">Active Projects</div>
        </div>
        <div className="card">
          <div className="kpi">{projects.filter(p => p.status === "COMPLETED").length}</div>
          <div className="kpi-label">Completed</div>
        </div>
        <div className="card">
          <div className="kpi">
            {projects.reduce((sum, p) => sum + p.completedMilestones, 0)}
          </div>
          <div className="kpi-label">Milestones Hit</div>
        </div>
        <div className="card">
          <div className="kpi">
            {Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)}%
          </div>
          <div className="kpi-label">Avg Progress</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Statuses</option>
            <option>Planning</option>
            <option>In Progress</option>
            <option>On Hold</option>
            <option>Completed</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>All Passions</option>
            <option>Visual Arts</option>
            <option>Music</option>
            <option>Service</option>
            <option>Entertainment</option>
          </select>
          <select className="button secondary" style={{ padding: "8px 12px" }}>
            <option>Sort: Recent</option>
            <option>Sort: Progress</option>
            <option>Sort: Due Date</option>
          </select>
        </div>
      </div>

      {/* Projects */}
      <div className="grid two">
        {projects.map((project) => (
          <div key={project.id} className="card" style={{
            borderTop: `4px solid ${getStatusColor(project.status)}`
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div style={{ fontSize: 48 }}>
                {project.thumbnailUrl}
              </div>
              <span className="pill" style={{
                backgroundColor: getStatusColor(project.status),
                color: "white",
                border: "none"
              }}>
                {getStatusLabel(project.status)}
              </span>
            </div>

            <h3 style={{ marginBottom: 8 }}>
              {project.title}
            </h3>

            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
              {project.passion}
            </p>

            <p style={{ fontSize: 14, marginBottom: 16 }}>
              {project.description}
            </p>

            {/* Tags */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {project.tags.map((tag, i) => (
                <span key={i} className="pill secondary" style={{ fontSize: 12 }}>
                  {tag}
                </span>
              ))}
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>
                  {project.completedMilestones} of {project.totalMilestones} milestones
                </span>
                <span>{project.progress}%</span>
              </div>
              <div style={{
                width: "100%",
                height: 8,
                backgroundColor: "var(--bg-secondary)",
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${project.progress}%`,
                  height: "100%",
                  backgroundColor: getStatusColor(project.status),
                  transition: "width 0.3s"
                }} />
              </div>
            </div>

            {/* Timeline */}
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              <div>Started: {new Date(project.startDate).toLocaleDateString()}</div>
              {project.targetEndDate && (
                <div>Target: {new Date(project.targetEndDate).toLocaleDateString()}</div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <a href={`/projects/${project.id}`} className="button primary" style={{ flex: 1 }}>
                View Project
              </a>
              <button className="button secondary">
                📊
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      {showNewProject && (
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
            <h3>Start New Project</h3>
            <form style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="My Amazing Project"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Passion Area *
                </label>
                <select required style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                  <option value="">Select passion area</option>
                  <option>Visual Arts</option>
                  <option>Music</option>
                  <option>Sports</option>
                  <option>Service</option>
                  <option>Writing</option>
                  <option>STEM</option>
                  <option>Entertainment</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="What will you create or accomplish?"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                    Target End Date
                  </label>
                  <input
                    type="date"
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Visibility
                </label>
                <select style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}>
                  <option value="PRIVATE">Private (only me)</option>
                  <option value="MENTORS_ONLY">Mentors & Instructors</option>
                  <option value="PUBLIC">Public (everyone)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Create Project
                </button>
                <button type="button" onClick={() => setShowNewProject(false)} className="button secondary">
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
