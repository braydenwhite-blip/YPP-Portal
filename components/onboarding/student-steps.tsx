"use client";

import { useRef } from "react";

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
  onNext: () => void;
  onBack: () => void;
  onProfileSave: (formData: FormData) => void;
  onSkip: () => void;
  isPending: boolean;
}

export default function StudentSteps({
  currentStep,
  userName,
  chapterName,
  profileData,
  onNext,
  onBack,
  onProfileSave,
  onSkip,
  isPending,
}: StudentStepsProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const firstName = userName.split(" ")[0];

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
            <p>Follow structured pathways from 101 through 301, building skills step by step in topics you love.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <h3>Get Mentored</h3>
            <p>Connect with experienced mentors who&apos;ll guide your progress and help you reach your goals.</p>
          </div>
          <div className="onboarding-feature-card">
            <div className="onboarding-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </div>
            <h3>Earn & Grow</h3>
            <p>Track your goals, earn certificates, attend events, and build a portfolio that stands out.</p>
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
        <h1 className="onboarding-title">Set Up Your Profile</h1>
        <p className="onboarding-subtitle">
          Tell us a bit about yourself so we can personalize your experience.
          You can always update this later in your settings.
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
            <input
              id="school"
              name="school"
              className="input"
              placeholder="e.g. Lincoln High School"
              defaultValue={profileData?.school ?? ""}
            />
          </div>

          <div className="form-row">
            <label htmlFor="grade">Grade Level</label>
            <select id="grade" name="grade" className="input" defaultValue={profileData?.grade ?? ""}>
              <option value="">Select your grade</option>
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label htmlFor="interests">Interests</label>
            <input
              id="interests"
              name="interests"
              className="input"
              placeholder="e.g. Music, Coding, Art, Science"
              defaultValue={profileData?.interests?.join(", ") ?? ""}
            />
            <span className="onboarding-hint">Separate with commas</span>
          </div>

          <div className="form-row">
            <label htmlFor="bio">About You</label>
            <textarea
              id="bio"
              name="bio"
              className="input"
              placeholder="Share a little about yourself, your passions, and what you hope to learn..."
              rows={3}
              defaultValue={profileData?.bio ?? ""}
            />
          </div>

          <div className="form-row">
            <label htmlFor="parentEmail">Parent/Guardian Email (optional)</label>
            <input
              id="parentEmail"
              name="parentEmail"
              type="email"
              className="input"
              placeholder="parent@email.com"
              defaultValue={profileData?.parentEmail ?? ""}
            />
          </div>

          <div className="form-row">
            <label htmlFor="parentPhone">Parent/Guardian Phone (optional)</label>
            <input
              id="parentPhone"
              name="parentPhone"
              type="tel"
              className="input"
              placeholder="(555) 123-4567"
              defaultValue={profileData?.parentPhone ?? ""}
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
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        </div>
        <h1 className="onboarding-title">How Pathways Work</h1>
        <p className="onboarding-subtitle">
          YPP uses a structured pathway system to help you build skills progressively
          in the subjects you care about most.
        </p>

        <div className="onboarding-pathway-visual">
          <div className="pathway-level">
            <div className="pathway-level-badge level-101">101</div>
            <div className="pathway-level-info">
              <h3>Foundations</h3>
              <p>Get introduced to a new topic. Learn the basics and discover what excites you.</p>
            </div>
          </div>
          <div className="pathway-connector" />
          <div className="pathway-level">
            <div className="pathway-level-badge level-201">201</div>
            <div className="pathway-level-info">
              <h3>Deep Dive</h3>
              <p>Build on your foundations with intermediate projects and more hands-on learning.</p>
            </div>
          </div>
          <div className="pathway-connector" />
          <div className="pathway-level">
            <div className="pathway-level-badge level-301">301</div>
            <div className="pathway-level-info">
              <h3>Mastery</h3>
              <p>Apply your skills to advanced challenges, lead projects, and mentor others.</p>
            </div>
          </div>
          <div className="pathway-connector" />
          <div className="pathway-level">
            <div className="pathway-level-badge level-lab">Labs</div>
            <div className="pathway-level-info">
              <h3>Passion Labs &amp; Beyond</h3>
              <p>Join specialized labs, competitions, and showcases to put your skills on display.</p>
            </div>
          </div>
        </div>

        <div className="onboarding-callout">
          <strong>You can browse all available pathways</strong> from the Pathways page
          and enroll in courses that match your interests.
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
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h1 className="onboarding-title">Goals &amp; Mentorship</h1>
        <p className="onboarding-subtitle">
          YPP is all about growth. Here&apos;s how we help you stay on track and
          reach your potential.
        </p>

        <div className="onboarding-info-grid">
          <div className="onboarding-info-card">
            <h3>Set Personal Goals</h3>
            <p>
              Choose from goal templates or create your own. Set target dates and track
              your progress with a four-level system.
            </p>
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
            <p>
              You&apos;ll be paired with a mentor who will check in with you monthly,
              provide feedback on your goals, and help you navigate your pathway.
            </p>
          </div>
          <div className="onboarding-info-card">
            <h3>Monthly Reflections</h3>
            <p>
              Each month, you&apos;ll complete a short reflection to think about
              what you&apos;ve learned, what&apos;s going well, and where you want to improve.
            </p>
          </div>
          <div className="onboarding-info-card">
            <h3>Events &amp; Community</h3>
            <p>
              Attend showcases, festivals, workshops, and competitions. RSVP to
              upcoming events and track your attendance record.
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
      <h1 className="onboarding-title">You&apos;re All Set, {firstName}!</h1>
      <p className="onboarding-subtitle">
        You&apos;re ready to start your journey. Here are some great places to begin:
      </p>

      <div className="onboarding-quicklinks">
        <a href="/pathways" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
          <div>
            <strong>Browse Pathways</strong>
            <span>Find a pathway that matches your interests</span>
          </div>
        </a>
        <a href="/curriculum" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
          <div>
            <strong>Explore Courses</strong>
            <span>See all available classes and labs</span>
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
        <a href="/messages" className="onboarding-quicklink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <div>
            <strong>Messages</strong>
            <span>Connect with mentors and peers</span>
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
