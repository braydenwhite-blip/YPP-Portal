"use client";

import { useState } from "react";

export default function MotivationBoostPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentBoost, setCurrentBoost] = useState<any | null>(null);

  // Sample data - in production, fetch from database
  const categories = [
    { id: "STUCK", label: "Feeling Stuck", icon: "🧱", color: "#f59e0b" },
    { id: "FRUSTRATED", label: "Frustrated", icon: "😤", color: "#ef4444" },
    { id: "DOUBTFUL", label: "Self-Doubt", icon: "😔", color: "#6366f1" },
    { id: "BURNOUT", label: "Burned Out", icon: "😫", color: "#ec4899" },
    { id: "GENERAL", label: "Need Boost", icon: "⚡", color: "#10b981" }
  ];

  const boosts: Record<string, any[]> = {
    STUCK: [
      {
        id: "1",
        message: "Plateaus are proof you're learning. Your brain is consolidating skills. Take a short break, try something slightly different, then come back. The breakthrough is closer than you think!",
        author: "Coach Rivera",
        videoUrl: null
      },
      {
        id: "2",
        message: "Being stuck means you're at the edge of your comfort zone - exactly where growth happens. Try teaching what you know to someone else. Explaining forces clarity and often reveals your next step.",
        author: "Ms. Chen",
        videoUrl: null
      }
    ],
    FRUSTRATED: [
      {
        id: "3",
        message: "Frustration = You care deeply. That's beautiful! But frustration is also a sign to step back. Go for a walk, sleep on it, come back fresh. Your passion will still be there, but your perspective will shift.",
        author: "Maya Rodriguez (Alumni)",
        videoUrl: null
      },
      {
        id: "4",
        message: "Every master was once a frustrated beginner. The difference? They didn't quit when it got hard. Take 5 deep breaths. Remember why you started. One more try, but tomorrow, not today.",
        author: "Alex Rivera",
        videoUrl: null
      }
    ],
    DOUBTFUL: [
      {
        id: "5",
        message: "Comparison is the thief of joy. That person you're comparing yourself to? They've been doing this 2 years longer, or they're showing their best work, not their journey. Your only competition is yesterday's you.",
        author: "Sarah Kim (Alumni)",
        videoUrl: null
      },
      {
        id: "6",
        message: "Self-doubt shows you're growing. Confident people don't question themselves because they're not pushing boundaries. You're scared because what you're attempting matters to you. That fear is evidence of courage, not lack of it.",
        author: "Dr. Johnson",
        videoUrl: "https://example.com/self-doubt-video"
      }
    ],
    BURNOUT: [
      {
        id: "7",
        message: "Rest is not quitting. Rest is required. Your brain needs downtime to process and grow. Take 3 days completely off. No guilt. Come back refreshed or don't come back - either is okay. This is about joy, not obligation.",
        author: "Coach Martinez",
        videoUrl: null
      },
      {
        id: "8",
        message: "Burnout happens when we forget why we started. Close your eyes. Remember that first spark of excitement. If it's gone, that's okay - passions evolve. If it's still there under the exhaustion, it's worth protecting with rest.",
        author: "Emma Chen (Alumni)",
        videoUrl: null
      }
    ],
    GENERAL: [
      {
        id: "9",
        message: "You showed up today. That's 90% of success. Consistency beats intensity every time. Even 10 minutes counts. Even just thinking about your passion counts. You're doing better than you think!",
        author: "Coach Rivera",
        videoUrl: null
      },
      {
        id: "10",
        message: "Progress isn't linear. You grew yesterday even if you can't see it today. Check your timeline from 3 months ago. That's proof. Future you is thanking present you for not giving up.",
        author: "Maya Johnson",
        videoUrl: null
      }
    ]
  };

  const getRandomBoost = (category: string) => {
    const categoryBoosts = boosts[category];
    const randomBoost = categoryBoosts[Math.floor(Math.random() * categoryBoosts.length)];
    setCurrentBoost(randomBoost);
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Support</p>
          <h1 className="page-title">Motivation Boost</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>💪 Quick Encouragement</h3>
        <p>
          Having a tough day? We've all been there. Get instant encouragement from mentors
          who've walked this path. You're not alone, and this feeling is temporary.
        </p>
      </div>

      {!selectedCategory ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>How are you feeling right now?</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Select what you're experiencing, and we'll give you words of encouragement
              from mentors who've been exactly where you are.
            </p>
          </div>

          <div className="grid two">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  getRandomBoost(category.id);
                }}
                className="card"
                style={{
                  cursor: "pointer",
                  border: "2px solid transparent",
                  transition: "all 0.2s",
                  textAlign: "left"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = category.color;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{
                    fontSize: 48,
                    width: 80,
                    height: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: category.color + "20",
                    borderRadius: 12
                  }}>
                    {category.icon}
                  </div>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{category.label}</h3>
                    <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
                      Click for encouragement →
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Boost Message */}
          <div className="card" style={{
            background: "linear-gradient(135deg, rgba(var(--primary-rgb), 0.1) 0%, transparent 100%)",
            border: "2px solid var(--primary-color)",
            padding: 40,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 80, marginBottom: 20 }}>
              {categories.find(c => c.id === selectedCategory)?.icon}
            </div>
            <h2 style={{ fontSize: 24, marginBottom: 24, lineHeight: 1.5 }}>
              "{currentBoost?.message}"
            </h2>
            <div style={{ fontSize: 16, color: "var(--text-secondary)", marginBottom: 24 }}>
              — {currentBoost?.author}
            </div>
            {currentBoost?.videoUrl && (
              <a href={currentBoost.videoUrl} target="_blank" className="button primary" style={{ marginBottom: 16 }}>
                📹 Watch Video Message
              </a>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
              <button
                onClick={() => getRandomBoost(selectedCategory)}
                className="button primary"
              >
                🔄 Another Message
              </button>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setCurrentBoost(null);
                }}
                className="button secondary"
              >
                ← Back
              </button>
            </div>
          </div>

          {/* Was this helpful? */}
          <div className="card" style={{ marginTop: 24, textAlign: "center" }}>
            <h4 style={{ marginBottom: 12 }}>Was this helpful?</h4>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="button secondary">
                👍 Yes, thanks!
              </button>
              <button className="button secondary">
                👎 Not really
              </button>
            </div>
          </div>
        </>
      )}

      {/* Additional Support */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>Need More Support?</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>💬 Talk to a Mentor</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
              Get personalized 1-on-1 feedback on your specific situation
            </p>
            <a href="/mentor/feedback" className="button secondary">
              Request Feedback
            </a>
          </div>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>🙋 Ask a Question</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
              Share your question with the mentor community
            </p>
            <a href="/mentor/ask" className="button secondary">
              Ask a Mentor
            </a>
          </div>
          <div>
            <h4 style={{ fontSize: 16, marginBottom: 8 }}>🌟 Success Stories</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
              Hear from students who overcame similar challenges
            </p>
            <a href="/stories" className="button secondary">
              Read Stories
            </a>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card" style={{ marginTop: 28, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💪</div>
        <h3 style={{ marginBottom: 12 }}>You've Got This!</h3>
        <p style={{ color: "var(--text-secondary)" }}>
          Over 5,000 students have used motivation boosts this month.
          Bad days happen to everyone. Keep going - tomorrow is a new chance!
        </p>
      </div>
    </div>
  );
}
