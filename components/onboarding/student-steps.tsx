"use client";

import { useRef } from "react";
import type { PathwayOption } from "./onboarding-wizard";

interface StudentStepsProps {
  currentStep: number;
  userName: string;
  chapterName?: string | null;
  profileData?: {
    bio?: string | null;
    school?: string | null;
    grade?: number | null;
    interests?: string[];
    parentEmail?: string | null;
    parentPhone?: string | null;
  } | null;
  pathways: PathwayOption[];
  selectedPathwayIds: Set<string>;
  quizAnswers: Set<string>;
  onQuizAnswerToggle: (answer: string) => void;
  onPathwaySelect: (id: string) => void;
  onPathwayContinue: () => void;
  onNext: () => void;
  onBack: () => void;
  onProfileSave: (formData: FormData) => void;
  onSkip: () => void;
  isPending: boolean;
}

const INTEREST_QUIZ_QUESTIONS = [
  {
    id: "topic",
    question: "Which topics excite you most?",
    options: [
      { label: "Science & Health", value: "science" },
      { label: "Technology & Engineering", value: "tech" },
      { label: "Arts & Creativity", value: "arts" },
      { label: "Social Sciences & People", value: "social" },
    ],
  },
  {
    id: "style",
    question: "How do you like to learn?",
    options: [
      { label: "Hands-on projects", value: "hands_on" },
      { label: "Research & reading", value: "research" },
      { label: "Group collaboration", value: "group" },
      { label: "Independent exploration", value: "independent" },
    ],
  },
  {
    id: "goal",
    question: "What's your main goal?",
    options: [
      { label: "College preparation", value: "college" },
      { label: "Career exploration", value: "career" },
      { label: "Building skills for fun", value: "fun" },
      { label: "Helping my community", value: "community" },
    ],
  },
];

// Simple keyword match to suggest a pathway based on quiz answers
function getRecommendedPathwayIds(pathways: PathwayOption[], quizAnswers: Set<string>): Set<string> {
  if (quizAnswers.size === 0) return new Set();
  const recommended = new Set<string>();
  for (const pathway of pathways) {
    const area = pathway.interestArea.toLowerCase();
    const desc = pathway.description.toLowerCase();
    if (
      (quizAnswers.has("science") && (area.includes("psych") || area.includes("bio") || area.includes("health") || area.includes("physio") || desc.includes("science"))) ||
      (quizAnswers.has("tech") && (area.includes("tech") || area.includes("eng") || area.includes("code") || area.includes("computer"))) ||
      (quizAnswers.has("arts") && (area.includes("art") || area.includes("music") || area.includes("design") || area.includes("creative"))) ||
      (quizAnswers.has("social") && (area.includes("social") || area.includes("psych") || area.includes("comm") || area.includes("history")))
    ) {
      recommended.add(pathway.id);
    }
  }
  // If nothing matched, show top 1 pathway as suggestion
  if (recommended.size === 0 && pathways.length > 0 && quizAnswers.size >= 2) {
    recommended.add(pathways[0].id);
  }
  return recommended;
}

export default function StudentSteps({
  currentStep,
  userName,
  chapterName,
  profileData,
  pathways,
  selectedPathwayIds,
  quizAnswers,
  onQuizAnswerToggle,
  onPathwaySelect,
  onPathwayContinue,
  onNext,
  onBack,
  onProfileSave,
  onSkip,
  isPending,
}: StudentStepsProps) {
  const recommendedPathwayIds = getRecommendedPathwayIds(pathways, quizAnswers);
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = userName.split(" ")[0];

  // Step 0: Welcome
  if (currentStep === 0) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
          </svg>
        </div>
        <h1 className="onboarding-title">Welcome to YPP Pathways, {firstName}!</h1>
        <p className="onboarding-subtitle">
          You&apos;re about to join a community of students exploring their passions through
          structured learning pathways, mentorship, and real-world projects.
        </p>

        <div className="onboarding-features-grid">
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
            </div>
            <h3>Learn Your Way</h3>
            <p>Follow structured pathways from 101 through 301, building skills step by step.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h3>Get Mentored</h3>
            <p>Connect with mentors who&apos;ll guide your progress and help you reach your goals.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <h3>Earn XP &amp; Level Up</h3>
            <p>Earn experience points, level up, and unlock achievements as you progress.</p>
          </div>
        </div>

        {chapterName && (
          <p className="onboarding-chapter-note">
            You&apos;re part of the <strong>{chapterName}</strong> chapter.
          </p>
        )}

        <div className="onboarding-actions">
          <button className="button" onClick={onNext} disabled={isPending}>
            Get Started
          </button>
          <button className="onboarding-skip" onClick={onSkip} disabled={isPending}>
            Skip onboarding
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Interest Quiz → Choose Your Pathway
  if (currentStep === 1) {
    const showQuiz = quizAnswers.size < 3; // Show quiz until user answers at least one question per category
    const quizDone = INTEREST_QUIZ_QUESTIONS.every((q) =>
      q.options.some((o) => quizAnswers.has(o.value))
    );

    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </div>

        {!quizDone ? (
          <>
            <h1 className="onboarding-title">Let&apos;s Find Your Path</h1>
            <p className="onboarding-subtitle">
              Answer a few quick questions so we can recommend the best pathway for you.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 24 }}>
              {INTEREST_QUIZ_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <p style={{ fontWeight: 600, marginBottom: 10 }}>{q.question}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {q.options.map((opt) => {
                      const isSelected = quizAnswers.has(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => onQuizAnswerToggle(opt.value)}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: `2px solid ${isSelected ? "var(--ypp-purple)" : "var(--gray-200, #e2e8f0)"}`,
                            background: isSelected ? "var(--purple-50, #faf5ff)" : "white",
                            color: isSelected ? "var(--ypp-purple)" : "var(--gray-700, #374151)",
                            fontWeight: isSelected ? 600 : 400,
                            cursor: "pointer",
                            textAlign: "left",
                            fontSize: 14,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="onboarding-actions">
              <button
                className="button"
                onClick={() => {
                  // Force advance to pathway selection even if quiz incomplete
                  // by triggering a dummy answer if nothing selected
                  if (quizAnswers.size === 0) onQuizAnswerToggle("fun");
                }}
                disabled={isPending}
              >
                {quizAnswers.size > 0 ? "See My Recommendations" : "Skip Quiz"}
              </button>
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="onboarding-title">Choose Your Pathway</h1>
            <p className="onboarding-subtitle">
              {recommendedPathwayIds.size > 0
                ? "Based on your interests, we highlighted pathways that fit you best. Pick one or more to get started."
                : "Pick one or more pathways that match your interests. Each pathway takes you from foundations (101) through mastery (301) and beyond."}
            </p>

            {pathways.length === 0 ? (
              <div className="onboarding-callout">
                No pathways available yet. Your chapter admin will add pathways soon.
                You can skip this step and choose later from the Pathways page.
              </div>
            ) : (
              <div className="pathway-selection-grid">
                {pathways.map((pathway) => {
                  const isSelected = selectedPathwayIds.has(pathway.id);
                  const isRecommended = recommendedPathwayIds.has(pathway.id);
                  return (
                    <button
                      key={pathway.id}
                      type="button"
                      className={`pathway-selection-card ${isSelected ? "selected" : ""}`}
                      onClick={() => onPathwaySelect(pathway.id)}
                      style={isRecommended && !isSelected ? { borderColor: "var(--ypp-purple)", boxShadow: "0 0 0 1px var(--ypp-purple)" } : undefined}
                    >
                      <div className="pathway-selection-header">
                        <div className="pathway-selection-check">
                          {isSelected ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--ypp-purple)" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4" /><polyline points="17 8 10 16 7 13" /></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4" /></svg>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <h3 className="pathway-selection-name">{pathway.name}</h3>
                            {isRecommended && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ypp-purple)", background: "var(--purple-50, #faf5ff)", padding: "2px 6px", borderRadius: 4 }}>
                                ★ Recommended
                              </span>
                            )}
                          </div>
                          <span className="pathway-selection-area">{pathway.interestArea}</span>
                        </div>
                      </div>
                      <p className="pathway-selection-desc">{pathway.description}</p>
                      <div className="pathway-selection-steps">
                        {pathway.steps.map((step, idx) => (
                          <span key={step.id} className="pathway-step-pill">
                            {idx > 0 && <span className="pathway-step-arrow">&rarr;</span>}
                            {step.courseLevel
                              ? step.courseLevel.replace("LEVEL_", "")
                              : step.courseFormat.replace("_", " ")}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="onboarding-actions">
              <button className="button" onClick={onPathwayContinue} disabled={isPending}>
                {selectedPathwayIds.size > 0
                  ? `Continue with ${selectedPathwayIds.size} pathway${selectedPathwayIds.size > 1 ? "s" : ""}`
                  : "Continue without selecting"}
              </button>
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Step 2: Profile Setup
  if (currentStep === 2) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="onboarding-title">Set Up Your Profile</h1>
        <p className="onboarding-subtitle">
          Tell us a bit about yourself so we can personalize your experience.
          You can always update this later.
        </p>

        <form
          ref={formRef}
          className="onboarding-form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(formRef.current!);
            onProfileSave(formData);
          }}
        >
          <div className="form-row">
            <label htmlFor="school">School</label>
            <input id="school" name="school" className="input" placeholder="e.g. Lincoln High School" defaultValue={profileData?.school ?? ""} />
          </div>
          <div className="form-row">
            <label htmlFor="grade">Grade Level</label>
            <select id="grade" name="grade" className="input" defaultValue={profileData?.grade ?? ""}>
              <option value="">Select your grade</option>
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="interests">Interests</label>
            <input id="interests" name="interests" className="input" placeholder="e.g. Music, Coding, Art, Science" defaultValue={profileData?.interests?.join(", ") ?? ""} />
            <span className="onboarding-hint">Separate with commas</span>
          </div>
          <div className="form-row">
            <label htmlFor="bio">About You</label>
            <textarea id="bio" name="bio" className="input" placeholder="Share a little about yourself..." rows={3} defaultValue={profileData?.bio ?? ""} />
          </div>
          <div className="form-row">
            <label htmlFor="parentEmail">Parent/Guardian Email (optional)</label>
            <input id="parentEmail" name="parentEmail" type="email" className="input" placeholder="parent@email.com" defaultValue={profileData?.parentEmail ?? ""} />
          </div>
          <div className="form-row">
            <label htmlFor="parentPhone">Parent/Guardian Phone (optional)</label>
            <input id="parentPhone" name="parentPhone" type="tel" className="input" placeholder="(555) 123-4567" defaultValue={profileData?.parentPhone ?? ""} />
          </div>

          <div className="onboarding-actions">
            <button type="submit" className="button" disabled={isPending}>Save &amp; Continue</button>
            <div className="onboarding-actions-secondary">
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>Back</button>
              <button type="button" className="onboarding-skip" onClick={onNext} disabled={isPending}>Skip for now</button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Step 3: Goals & Mentorship
  if (currentStep === 3) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h1 className="onboarding-title">Goals &amp; Mentorship</h1>
        <p className="onboarding-subtitle">
          YPP is all about growth. Here&apos;s how we help you stay on track.
        </p>

        <div className="onboarding-info-grid">
          <div className="onboarding-info-card">
            <h3>Set Personal Goals</h3>
            <p>Choose from goal templates or create your own. Track progress with a four-level system.</p>
            <div className="onboarding-progress-demo">
              <div className="demo-level" style={{ background: "var(--progress-behind)" }} />
              <div className="demo-level" style={{ background: "var(--progress-getting-started)" }} />
              <div className="demo-level" style={{ background: "var(--progress-on-track)" }} />
              <div className="demo-level" style={{ background: "var(--progress-above)" }} />
            </div>
            <p className="onboarding-hint">Behind &middot; Getting Started &middot; On Track &middot; Above &amp; Beyond</p>
          </div>
          <div className="onboarding-info-card">
            <h3>Your Mentor</h3>
            <p>You&apos;ll be paired with a mentor who will check in monthly and help you navigate your pathway.</p>
          </div>
          <div className="onboarding-info-card">
            <h3>Earn XP</h3>
            <p>Every course you complete, event you attend, and goal you hit earns experience points. Level up from Explorer to Legend!</p>
          </div>
          <div className="onboarding-info-card">
            <h3>Events &amp; Community</h3>
            <p>Attend showcases, festivals, workshops, and competitions. RSVP and build your attendance record.</p>
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="button" onClick={onNext} disabled={isPending}>Continue</button>
          <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>Back</button>
        </div>
      </div>
    );
  }

  // Step 4: Completion
  return (
    <div className="onboarding-step onboarding-complete">
      <div className="onboarding-icon-large onboarding-icon-success">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--progress-on-track)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <h1 className="onboarding-title">You&apos;re All Set, {firstName}!</h1>
      <p className="onboarding-subtitle">
        You&apos;re ready to start your journey. Here are some great places to begin:
      </p>

      <div className="onboarding-quicklinks">
        <a href="/pathways" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
          <div>
            <strong>Browse Pathways</strong>
            <span>Find more pathways that match your interests</span>
          </div>
        </a>
        <a href="/my-courses" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <div>
            <strong>My Courses</strong>
            <span>See the courses you&apos;re enrolled in</span>
          </div>
        </a>
        <a href="/goals" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          <div>
            <strong>Set Your Goals</strong>
            <span>Choose goals and start tracking progress</span>
          </div>
        </a>
        <a href="/events" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <div>
            <strong>Upcoming Events</strong>
            <span>RSVP to showcases, workshops, and more</span>
          </div>
        </a>
      </div>

      <div className="onboarding-actions">
        <button className="button" onClick={onNext} disabled={isPending}>
          Go to My Dashboard
        </button>
        <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
          Back
        </button>
      </div>
    </div>
  );
}
