"use client";

import { useState } from "react";

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    learningGoals: [] as string[],
    availableHours: "",
    preferredLearningStyle: "",
    primaryPassion: "",
    experienceLevel: ""
  });

  const totalSteps = 5;

  const handleCheckboxChange = (field: string, value: string) => {
    const currentValues = formData[field as keyof typeof formData] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    setFormData({ ...formData, [field]: newValues });
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      {/* Progress Bar */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Step {currentStep} of {totalSteps}
          </span>
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {Math.round((currentStep / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div style={{
          height: 8,
          backgroundColor: "var(--border-color)",
          borderRadius: 4,
          overflow: "hidden"
        }}>
          <div style={{
            height: "100%",
            width: `${(currentStep / totalSteps) * 100}%`,
            backgroundColor: "var(--primary-color)",
            transition: "width 0.3s"
          }} />
        </div>
      </div>

      {/* Step 1: Welcome */}
      {currentStep === 1 && (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>🎉</div>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>Welcome to YPP Portal!</h1>
          <p style={{ fontSize: 18, color: "var(--text-secondary)", marginBottom: 32, lineHeight: 1.6 }}>
            We're excited to help you discover and develop your passions! Let's take a few minutes to
            personalize your experience so we can recommend the best resources and opportunities for you.
          </p>
          <button onClick={handleNext} className="button primary" style={{ fontSize: 18, padding: "12px 32px" }}>
            Let's Get Started →
          </button>
        </div>
      )}

      {/* Step 2: Learning Goals */}
      {currentStep === 2 && (
        <div className="card" style={{ padding: 40 }}>
          <h2 style={{ marginBottom: 12 }}>What are your goals?</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            Select all that apply. This helps us recommend the right classes and resources.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { value: "college_prep", label: "Build portfolio for college applications", icon: "🎓" },
              { value: "career", label: "Explore potential career paths", icon: "💼" },
              { value: "hobby", label: "Develop a hobby I'm passionate about", icon: "❤️" },
              { value: "skills", label: "Learn new skills and techniques", icon: "🎨" },
              { value: "social", label: "Meet others who share my interests", icon: "👥" },
              { value: "compete", label: "Compete in contests and showcases", icon: "🏆" }
            ].map((goal) => (
              <label
                key={goal.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 20,
                  border: "2px solid var(--border-color)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: formData.learningGoals.includes(goal.value) ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                  borderColor: formData.learningGoals.includes(goal.value) ? "var(--primary-color)" : "var(--border-color)"
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.learningGoals.includes(goal.value)}
                  onChange={() => handleCheckboxChange("learningGoals", goal.value)}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontSize: 32 }}>{goal.icon}</span>
                <span style={{ fontSize: 16, fontWeight: 500 }}>{goal.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Available Time */}
      {currentStep === 3 && (
        <div className="card" style={{ padding: 40 }}>
          <h2 style={{ marginBottom: 12 }}>How much time can you dedicate each week?</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            This helps us suggest a realistic learning path that fits your schedule.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
            {[
              { value: "2", label: "1-2 hours", subtitle: "Light commitment" },
              { value: "5", label: "3-5 hours", subtitle: "Moderate pace" },
              { value: "10", label: "6-10 hours", subtitle: "Dedicated learner" },
              { value: "15", label: "10+ hours", subtitle: "Intensive focus" }
            ].map((option) => (
              <div
                key={option.value}
                onClick={() => setFormData({ ...formData, availableHours: option.value })}
                style={{
                  padding: 24,
                  border: "2px solid var(--border-color)",
                  borderRadius: 8,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s",
                  backgroundColor: formData.availableHours === option.value ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                  borderColor: formData.availableHours === option.value ? "var(--primary-color)" : "var(--border-color)"
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{option.label}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{option.subtitle}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Learning Style */}
      {currentStep === 4 && (
        <div className="card" style={{ padding: 40 }}>
          <h2 style={{ marginBottom: 12 }}>How do you learn best?</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            We'll prioritize content that matches your learning style.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { value: "video", label: "Watching video tutorials", icon: "🎥", desc: "You prefer visual demonstrations" },
              { value: "hands_on", label: "Hands-on practice and experimentation", icon: "🛠️", desc: "You learn by doing" },
              { value: "reading", label: "Reading guides and articles", icon: "📚", desc: "You like detailed written instructions" },
              { value: "interactive", label: "Interactive lessons and quizzes", icon: "💡", desc: "You enjoy active participation" },
              { value: "social", label: "Learning from peers and instructors", icon: "👥", desc: "You thrive in group settings" }
            ].map((style) => (
              <div
                key={style.value}
                onClick={() => setFormData({ ...formData, preferredLearningStyle: style.value })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: 20,
                  border: "2px solid var(--border-color)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor: formData.preferredLearningStyle === style.value ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                  borderColor: formData.preferredLearningStyle === style.value ? "var(--primary-color)" : "var(--border-color)"
                }}
              >
                <span style={{ fontSize: 40 }}>{style.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{style.label}</div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{style.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {currentStep === 5 && (
        <div className="card" style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>✨</div>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>You're All Set!</h1>
          <p style={{ fontSize: 18, color: "var(--text-secondary)", marginBottom: 32, lineHeight: 1.6 }}>
            Your personalized experience is ready. We've prepared some recommended resources and classes
            based on your goals and preferences. Let's start exploring!
          </p>

          <div style={{
            backgroundColor: "var(--bg-secondary)",
            padding: 24,
            borderRadius: 8,
            marginBottom: 32,
            textAlign: "left"
          }}>
            <h3 style={{ marginBottom: 16 }}>Your Profile Summary:</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15 }}>
              <div>
                <strong>Goals:</strong> {formData.learningGoals.length} selected
              </div>
              <div>
                <strong>Available Time:</strong> {formData.availableHours ? `${formData.availableHours} hours/week` : "Not specified"}
              </div>
              <div>
                <strong>Learning Style:</strong> {formData.preferredLearningStyle ? formData.preferredLearningStyle.replace("_", " ") : "Not specified"}
              </div>
            </div>
          </div>

          <form action="/api/onboarding/complete" method="POST">
            <input type="hidden" name="learningGoals" value={JSON.stringify(formData.learningGoals)} />
            <input type="hidden" name="availableHours" value={formData.availableHours} />
            <input type="hidden" name="preferredLearningStyle" value={formData.preferredLearningStyle} />
            <button type="submit" className="button primary" style={{ fontSize: 18, padding: "12px 32px" }}>
              Start My Journey →
            </button>
          </form>
        </div>
      )}

      {/* Navigation */}
      {currentStep > 1 && currentStep < totalSteps && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <button onClick={handleBack} className="button secondary">
            ← Back
          </button>
          <button onClick={handleNext} className="button primary">
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
