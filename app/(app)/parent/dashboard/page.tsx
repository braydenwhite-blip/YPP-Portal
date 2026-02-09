"use client";

import { useState } from "react";

export default function ParentDashboardPage() {
  const [selectedStudent, setSelectedStudent] = useState("sarah-chen");

  // Sample data - in production, fetch from database
  const myStudents = [
    {
      id: "sarah-chen",
      name: "Sarah Chen",
      grade: "11th",
      primaryPassion: "Visual Arts",
      activePassions: 3,
      level: 8,
      xp: 2450,
      photoUrl: null
    }
  ];

  const currentStudent = myStudents.find(s => s.id === selectedStudent);

  const recentActivity = [
    {
      id: "1",
      type: "ACHIEVEMENT",
      icon: "🏆",
      title: "Earned 'Creative Vision' Award",
      description: "Recognized for outstanding composition in landscape paintings",
      timestamp: "2 days ago",
      color: "#10b981"
    },
    {
      id: "2",
      type: "MILESTONE",
      icon: "✅",
      title: "Completed 'Mountain Sunset Series'",
      description: "Finished 5-painting portfolio project in Visual Arts",
      timestamp: "5 days ago",
      color: "#6366f1"
    },
    {
      id: "3",
      type: "PRACTICE",
      icon: "📊",
      title: "7-Day Practice Streak",
      description: "Logged 12.5 hours of watercolor practice this week",
      timestamp: "1 week ago",
      color: "#f59e0b"
    },
    {
      id: "4",
      type: "FEEDBACK",
      icon: "💬",
      title: "Received Mentor Feedback",
      description: "Ms. Chen provided detailed feedback on portfolio",
      timestamp: "1 week ago",
      color: "#ec4899"
    },
    {
      id: "5",
      type: "NEW_PASSION",
      icon: "✨",
      title: "Started Exploring Photography",
      description: "Began learning digital photography techniques",
      timestamp: "2 weeks ago",
      color: "#8b5cf6"
    }
  ];

  const upcomingEvents = [
    {
      id: "1",
      title: "Spring Art Showcase",
      date: "March 25, 2024",
      time: "6:00 PM - 8:00 PM",
      location: "Philadelphia Chapter",
      type: "SHOWCASE",
      isPresenting: true
    },
    {
      id: "2",
      title: "Advanced Watercolor Workshop",
      date: "March 22, 2024",
      time: "4:00 PM - 6:00 PM",
      location: "Virtual",
      type: "WORKSHOP",
      isPresenting: false
    }
  ];

  const passionProgress = [
    {
      id: "1",
      name: "Visual Arts",
      level: "Advanced",
      hoursLogged: 48.5,
      projectsCompleted: 3,
      skillsLearned: 12,
      color: "#ef4444"
    },
    {
      id: "2",
      name: "Photography",
      level: "Beginner",
      hoursLogged: 8.5,
      projectsCompleted: 0,
      skillsLearned: 4,
      color: "#6366f1"
    },
    {
      id: "3",
      name: "Writing",
      level: "Intermediate",
      hoursLogged: 15.5,
      projectsCompleted: 1,
      skillsLearned: 7,
      color: "#10b981"
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">My Student Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="button secondary">
            Download Report
          </button>
          <button className="button secondary">
            Message Instructor
          </button>
        </div>
      </div>

      {/* Student Selector (if multiple students) */}
      {myStudents.length > 1 && (
        <div className="card" style={{ marginBottom: 28 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Viewing Progress For:
          </label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            style={{ width: "100%", maxWidth: 400, padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
          >
            {myStudents.map(student => (
              <option key={student.id} value={student.id}>
                {student.name} - {student.grade} Grade
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Student Overview Card */}
      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 20, alignItems: "start" }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "var(--primary-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 32,
            fontWeight: 600
          }}>
            {currentStudent?.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 4 }}>{currentStudent?.name}</h2>
            <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 12 }}>
              {currentStudent?.grade} Grade • Primary Passion: {currentStudent?.primaryPassion}
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Level</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "var(--primary-color)" }}>
                  {currentStudent?.level}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total XP</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{currentStudent?.xp}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Active Passions</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{currentStudent?.activePassions}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid four" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="kpi">48.5</div>
          <div className="kpi-label">Hours This Month</div>
        </div>
        <div className="card">
          <div className="kpi">3</div>
          <div className="kpi-label">Projects Completed</div>
        </div>
        <div className="card">
          <div className="kpi">5</div>
          <div className="kpi-label">Awards Earned</div>
        </div>
        <div className="card">
          <div className="kpi">95%</div>
          <div className="kpi-label">Attendance Rate</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28, marginBottom: 28 }}>
        {/* Recent Activity */}
        <div>
          <h3 style={{ marginBottom: 16 }}>Recent Activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recentActivity.map((activity) => (
              <div key={activity.id} className="card" style={{
                borderLeft: `4px solid ${activity.color}`
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
                  <div style={{ fontSize: 32 }}>{activity.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{activity.title}</div>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {activity.description}
                    </p>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {activity.timestamp}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div>
          <h3 style={{ marginBottom: 16 }}>Upcoming Events</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {upcomingEvents.map((event) => (
              <div key={event.id} className="card">
                <h4 style={{ fontSize: 15, marginBottom: 8 }}>{event.title}</h4>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  📅 {event.date}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  🕐 {event.time}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  📍 {event.location}
                </div>
                {event.isPresenting && (
                  <span className="pill" style={{
                    backgroundColor: "#10b981",
                    color: "white",
                    border: "none"
                  }}>
                    Presenting
                  </span>
                )}
              </div>
            ))}
          </div>

          <a href="/parent/events" className="button secondary" style={{ width: "100%", marginTop: 12 }}>
            View All Events
          </a>
        </div>
      </div>

      {/* Passion Progress */}
      <div>
        <h3 style={{ marginBottom: 16 }}>Passion Areas Progress</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {passionProgress.map((passion) => (
            <div key={passion.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <h4 style={{ marginBottom: 4 }}>{passion.name}</h4>
                  <span className="pill" style={{
                    backgroundColor: passion.color + "20",
                    color: passion.color,
                    border: `1px solid ${passion.color}`
                  }}>
                    {passion.level}
                  </span>
                </div>
                <button className="button secondary" style={{ fontSize: 13 }}>
                  View Details →
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Hours Logged
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{passion.hoursLogged}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Projects Done
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{passion.projectsCompleted}</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                    Skills Learned
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{passion.skillsLearned}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <a href="/parent/reports" className="button secondary">
            📊 View Full Reports
          </a>
          <a href="/parent/messages" className="button secondary">
            💬 Message Instructors
          </a>
          <a href={`/portfolio`} className="button secondary">
            📁 View Portfolio
          </a>
          <a href="/parent/settings" className="button secondary">
            ⚙️ Notification Settings
          </a>
        </div>
      </div>
    </div>
  );
}
