"use client";

import { useRef } from "react";

interface InstructorStepsProps {
  currentStep: number;
  userName: string;
  chapterName?: string | null;
  profileData?: {
    bio?: string | null;
    school?: string | null;
    grade?: number | null;
    interests?: string[];
    curriculumUrl?: string | null;
  } | null;
  onNext: () => void;
  onBack: () => void;
  onProfileSave: (formData: FormData) => void;
  onSkip: () => void;
  isPending: boolean;
}

export default function InstructorSteps({
  currentStep,
  userName,
  chapterName,
  profileData,
  onNext,
  onBack,
  onProfileSave,
  onSkip,
  isPending,
}: InstructorStepsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = userName.split(" ")[0];

  if (currentStep === 0) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h1 className="onboarding-title">Welcome, Instructor {firstName}!</h1>
        <p className="onboarding-subtitle">
          Thank you for joining YPP as an instructor. You play a critical role in guiding
          students through their learning pathways and helping them discover their passions.
        </p>

        <div className="onboarding-features-grid">
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            </div>
            <h3>Teach &amp; Inspire</h3>
            <p>Lead classes across multiple formats: leveled courses, labs, one-offs, and competition prep.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <h3>Level Up</h3>
            <p>Complete training modules to unlock teaching at higher levels (101 &rarr; 201 &rarr; 301).</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h3>Mentor Students</h3>
            <p>Be paired with students as a mentor. Guide their growth and provide feedback on their journey.</p>
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

  if (currentStep === 1) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="onboarding-title">Set Up Your Instructor Profile</h1>
        <p className="onboarding-subtitle">
          Help students and fellow instructors get to know you. This info is visible
          on your profile and helps with mentorship matching.
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
            <label htmlFor="bio">About You &amp; Teaching Experience</label>
            <textarea
              id="bio"
              name="bio"
              className="input"
              placeholder="Share your background, teaching experience, and what drives you as an instructor..."
              rows={4}
              defaultValue={profileData?.bio ?? ""}
            />
          </div>

          <div className="form-row">
            <label htmlFor="interests">Subject Areas / Expertise</label>
            <input
              id="interests"
              name="interests"
              className="input"
              placeholder="e.g. Music Production, Web Development, Creative Writing"
              defaultValue={profileData?.interests?.join(", ") ?? ""}
            />
            <span className="onboarding-hint">Separate with commas</span>
          </div>

          <div className="form-row">
            <label htmlFor="school">School / Organization (if applicable)</label>
            <input
              id="school"
              name="school"
              className="input"
              placeholder="e.g. Lincoln High School, Community Center"
              defaultValue={profileData?.school ?? ""}
            />
          </div>

          <div className="form-row">
            <label htmlFor="curriculumUrl">Curriculum / Portfolio Link (optional)</label>
            <input
              id="curriculumUrl"
              name="curriculumUrl"
              type="url"
              className="input"
              placeholder="https://your-portfolio.com"
              defaultValue={profileData?.curriculumUrl ?? ""}
            />
          </div>

          <div className="onboarding-actions">
            <button type="submit" className="button" disabled={isPending}>
              Save &amp; Continue
            </button>
            <div className="onboarding-actions-secondary">
              <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
                Back
              </button>
              <button type="button" className="onboarding-skip" onClick={onNext} disabled={isPending}>
                Skip for now
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (currentStep === 2) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <h1 className="onboarding-title">Instructor Training</h1>
        <p className="onboarding-subtitle">
          Before you begin teaching, you&apos;ll complete a structured training program
          designed to prepare you for the YPP classroom experience.
        </p>

        <div className="onboarding-training-overview">
          <div className="training-module-preview">
            <div className="training-module-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            </div>
            <div>
              <h3>Workshops</h3>
              <p>Interactive sessions on YPP teaching methods and classroom management.</p>
            </div>
          </div>
          <div className="training-module-preview">
            <div className="training-module-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div>
              <h3>Scenario Practice</h3>
              <p>Practice handling real classroom scenarios and student interactions.</p>
            </div>
          </div>
          <div className="training-module-preview">
            <div className="training-module-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
            </div>
            <div>
              <h3>Curriculum Review</h3>
              <p>Review course materials and learn how the pathway system works.</p>
            </div>
          </div>
          <div className="training-module-preview">
            <div className="training-module-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
            </div>
            <div>
              <h3>Video Content</h3>
              <p>Watch training videos with progress tracking so you can learn at your own pace.</p>
            </div>
          </div>
        </div>

        <div className="onboarding-callout">
          <strong>Your training modules</strong> will appear on the Instructor Training
          page once assigned. You can track your progress there at any time.
        </div>

        <div className="onboarding-actions">
          <button className="button" onClick={onNext} disabled={isPending}>
            Continue
          </button>
          <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 3) {
    return (
      <div className="onboarding-step">
        <div className="onboarding-icon-large">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ypp-purple)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" />
          </svg>
        </div>
        <h1 className="onboarding-title">Teaching at YPP</h1>
        <p className="onboarding-subtitle">
          Here&apos;s how the teaching and approval system works at YPP Pathways.
        </p>

        <div className="onboarding-info-grid">
          <div className="onboarding-info-card">
            <h3>Course Levels &amp; Approval</h3>
            <p>
              Instructors are approved to teach at specific levels. Start at 101 and
              work your way up to 201 and 301 as you gain experience and complete
              additional training.
            </p>
            <div className="onboarding-level-badges">
              <span className="pill level-101">101 - Foundations</span>
              <span className="pill level-201">201 - Intermediate</span>
              <span className="pill level-301">301 - Advanced</span>
            </div>
          </div>
          <div className="onboarding-info-card">
            <h3>Class Formats</h3>
            <p>YPP offers multiple class formats depending on the subject and student needs:</p>
            <ul className="onboarding-format-list">
              <li><strong>Leveled:</strong> Progressive classes (101 &rarr; 201 &rarr; 301)</li>
              <li><strong>One-Off:</strong> Standalone workshops on specific topics</li>
              <li><strong>Labs:</strong> Extended project-based sessions</li>
              <li><strong>Competition Prep:</strong> Preparing students for competitions</li>
            </ul>
          </div>
          <div className="onboarding-info-card">
            <h3>Mentorship Duties</h3>
            <p>
              As an instructor, you may be paired with students as their mentor.
              You&apos;ll provide monthly check-ins, feedback on goals, and guidance
              throughout their pathway journey.
            </p>
          </div>
          <div className="onboarding-info-card">
            <h3>Certificates &amp; Awards</h3>
            <p>
              Earn Bronze, Silver, and Gold instructor awards as you grow. Students
              also receive certificates when they complete courses and pathways you teach.
            </p>
          </div>
        </div>

        <div className="onboarding-actions">
          <button className="button" onClick={onNext} disabled={isPending}>
            Continue
          </button>
          <button type="button" className="button outline small" onClick={onBack} disabled={isPending}>
            Back
          </button>
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
      <h1 className="onboarding-title">You&apos;re Ready, {firstName}!</h1>
      <p className="onboarding-subtitle">
        You&apos;re all set to start your journey as a YPP instructor. Here are the key areas to explore:
      </p>

      <div className="onboarding-quicklinks">
        <a href="/instructor-training" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          <div>
            <strong>Instructor Training</strong>
            <span>Complete your training modules and get approved</span>
          </div>
        </a>
        <a href="/curriculum" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <div>
            <strong>Browse Curriculum</strong>
            <span>See all courses and what you may teach</span>
          </div>
        </a>
        <a href="/mentorship" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <div>
            <strong>Mentorship Dashboard</strong>
            <span>View mentee assignments and check-ins</span>
          </div>
        </a>
        <a href="/events" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <div>
            <strong>Upcoming Events</strong>
            <span>RSVP to showcases, workshops, and competitions</span>
          </div>
        </a>
        <a href="/reflection" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          <div>
            <strong>Monthly Reflections</strong>
            <span>Submit your monthly teaching reflections</span>
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
