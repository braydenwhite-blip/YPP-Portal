"use client";

import { useState } from "react";

export default function StudentHomePage() {
  // Sample data - in production, fetch from database based on personalization settings
  const student = {
    name: "Sarah",
    level: 8,
    xp: 2450,
    xpToNextLevel: 3000,
    currentStreak: 7
  };

  const todaysInspiration = {
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  };

  const quickActions = [
    { id: "1", icon: "📝", text: "Log Today's Practice", url: "/learn/practice", color: "#6366f1" },
    { id: "2", icon: "🎥", text: "Continue: Watercolor Techniques", url: "/learn/modules", color: "#10b981" },
    { id: "3", icon: "💬", text: "New Feedback on Portfolio", url: "/projects/feedback", color: "#ec4899" },
    { id: "4", icon: "🏆", text: "You earned a new award!", url: "/awards", color: "#f59e0b" }
  ];

  const upcomingClasses = [
    {
      id: "1",
      title: "Advanced Watercolor Workshop",
      instructor: "Ms. Chen",
      date: "Today",
      time: "4:00 PM - 6:00 PM",
      location: "Virtual",
      zoomLink: "https://zoom.us/j/123456789"
    },
    {
      id: "2",
      title: "Portfolio Review Session",
      instructor: "Mr. Anderson",
      date: "Tomorrow",
      time: "3:00 PM - 4:30 PM",
      location: "Philadelphia Chapter"
    }
  ];

  const recentActivity = [
    { id: "1", icon: "🎨", text: "Completed Mountain Sunset Series", time: "2 days ago" },
    { id: "2", icon: "⭐", text: "Earned 'Creative Vision' Award", time: "3 days ago" },
    { id: "3", icon: "📊", text: "Reached 7-day practice streak", time: "Today" }
  ];

  const suggestedForYou = [
    {
      id: "1",
      title: "Color Theory Fundamentals",
      type: "Video Module",
      duration: "45 min",
      thumbnail: null
    },
    {
      id: "2",
      title: "Spring Art Showcase Registration",
      type: "Event",
      date: "March 25",
      thumbnail: null
    },
    {
      id: "3",
      title: "Photography Basics Try-It Session",
      type: "Try-It",
      duration: "30 min",
      thumbnail: null
    }
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Welcome back, {student.name}! 👋</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Inspiration Quote */}
      <div className="card" style={{ 
        marginBottom: 28, 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        border: "none"
      }}>
        <div style={{ fontSize: 20, fontStyle: "italic", marginBottom: 12, lineHeight: 1.6 }}>
          "{todaysInspiration.quote}"
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>
          — {todaysInspiration.author}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28, marginBottom: 28 }}>
        {/* Main Content */}
        <div>
          {/* Quick Actions */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ marginBottom: 16 }}>Quick Actions</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {quickActions.map((action) => (
                <a
                  key={action.id}
                  href={action.url}
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textDecoration: "none",
                    borderLeft: `4px solid ${action.color}`
                  }}
                >
                  <span style={{ fontSize: 32 }}>{action.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{action.text}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Upcoming Classes */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Upcoming Classes</h3>
              <a href="/classes" className="button secondary" style={{ fontSize: 13 }}>
                View All →
              </a>
            </div>
            {upcomingClasses.map((cls) => (
              <div key={cls.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>{cls.title}</h4>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>
                      👨‍🏫 {cls.instructor}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>
                      📅 {cls.date} at {cls.time}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      📍 {cls.location}
                    </div>
                  </div>
                  {cls.zoomLink && (
                    <a href={cls.zoomLink} target="_blank" className="button primary" style={{ fontSize: 13 }}>
                      Join Zoom
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Suggested For You */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Suggested For You</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16 }}>
              {suggestedForYou.map((item) => (
                <div key={item.id} className="card" style={{ cursor: "pointer" }}>
                  <div style={{
                    height: 120,
                    backgroundColor: "var(--bg-secondary)",
                    borderRadius: 6,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40
                  }}>
                    {item.type === "Video Module" && "🎥"}
                    {item.type === "Event" && "🎪"}
                    {item.type === "Try-It" && "✨"}
                  </div>
                  <h4 style={{ fontSize: 15, marginBottom: 8 }}>{item.title}</h4>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {item.type} {item.duration && `• ${item.duration}`} {item.date && `• ${item.date}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Progress Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 16 }}>Your Progress</h4>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>Level {student.level}</span>
                <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {student.xp} / {student.xpToNextLevel} XP
                </span>
              </div>
              <div style={{
                height: 12,
                backgroundColor: "var(--border-color)",
                borderRadius: 6,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${(student.xp / student.xpToNextLevel) * 100}%`,
                  backgroundColor: "var(--primary-color)",
                  transition: "width 0.3s"
                }} />
              </div>
            </div>
            <div style={{
              padding: 16,
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              borderRadius: 8,
              textAlign: "center"
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
              <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
                {student.currentStreak} Days
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Current Streak
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h4 style={{ marginBottom: 16 }}>Recent Activity</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentActivity.map((activity) => (
                <div key={activity.id} style={{ display: "flex", gap: 12, alignItems: "start" }}>
                  <span style={{ fontSize: 24 }}>{activity.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{activity.text}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{activity.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <a href="/profile/timeline" className="button secondary" style={{ width: "100%", marginTop: 16 }}>
              View Full Timeline
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
