"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import styles from "./instructor-onboarding-guide.module.css";
import { Button, ButtonLink } from "@/components/ui-v2";
import OnboardingStepper, { type OnboardingStep } from "./onboarding-stepper";
import InstructorProfileForm, {
  type InstructorProfileFormData,
} from "@/components/onboarding/instructor-profile-form";
import TrainingHome from "@/components/instructor-training/training-home";
import type { TrainingHomeModel } from "@/lib/training-phases";
import {
  saveJourneyStep,
  completeJourneyStep,
  completeInstructorJourney,
} from "@/lib/instructor-journey-actions";
import {
  JOURNEY_STEP_ORDER,
  LAUNCHPAD_STEP_COUNT,
  type InstructorJourneyState,
  type JourneyStepKey,
} from "@/lib/instructor-journey";

/* ------------------------------------------------------------------
   Onboarding copy — distinct content preserved from the original guide.
   Wording, punctuation, capitalization and existing typos preserved.
   ------------------------------------------------------------------ */

const coreExpectations = [
  "Deliver organized, engaging classes using approved curriculum that keeps students participating and coming back",
  "Build strong, supportive relationships with students and families through professional and responsive communication",
  "Respond to all messages within 24 hours, attend every required meeting, and show up to every class prepared and on time",
  "Participate actively in the YPP community through events and trainings, as well as building relationships with fellow instructors to go beyond what is required",
  "Show openness to feedback and a willingness to contribute beyond your core teaching responsibilities when the opportunity arises",
];

const contactLines = [
  "If you have questions about your class or curriculum, please contact your mentor or the assigned Lead Instructor (who is either an expert in the subject matter or runs the relationship with that partner institution).",
  "If you have questions about YPP community events, please contact your chapter president.",
  "If you have tech questions, contact tech@youthpassionproject.org",
  "If you have social media or marketing ideas, contact sanvi.mehta@youthpassionproject.org",
  "If you have questions about chapters, chapter structure, or starting a chapter in your area, contact ian.dilorenzo@youthpassionproject.org",
];

const portalItems = [
  "Your Dashboard — An overview of your upcoming sessions, assigned courses, and action items",
  "Course Materials — Access to all curriculum resources, lesson plans, and supplementary materials for your assigned courses",
  "Session Logging — A simple form to record what you covered, student attendance, and any notes after each session",
  "Training Modules — Required onboarding videos and readings",
];

/* ---------------------------- Steps ---------------------------- */

type IconName = "spark" | "user" | "calendar" | "compass" | "check" | "message";

interface StepDef extends OnboardingStep {
  id: JourneyStepKey;
  eyebrow: string;
  icon: IconName;
}

const STEPS: StepDef[] = [
  { id: "welcome", label: "Welcome & your role", kicker: "Step 1", eyebrow: "Orientation + expectations", icon: "spark" },
  { id: "profile", label: "Profile", kicker: "Step 2", eyebrow: "Tell us about you", icon: "user" },
  { id: "training", label: "Training", kicker: "Step 3", eyebrow: "Before your first session", icon: "calendar" },
  { id: "community", label: "Help & community", kicker: "Step 4", eyebrow: "Where to get support", icon: "message" },
  { id: "tour", label: "Portal tour", kicker: "Step 5", eyebrow: "Guided portal tour", icon: "compass" },
];

/* ----------------------------- Icon ---------------------------- */

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
  };

  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <path d="M7 3v4M17 3v4M5.5 6h13A1.5 1.5 0 0 1 20 7.5v12A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-12A1.5 1.5 0 0 1 5.5 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4 4L19 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "compass":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="m14.8 8.2-2 5.5a1 1 0 0 1-.6.6l-5.5 2 2-5.5a1 1 0 0 1 .6-.6l5.5-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M5.5 5.5h13A1.5 1.5 0 0 1 20 7v8a1.5 1.5 0 0 1-1.5 1.5H11L6 20v-3.5h-.5A1.5 1.5 0 0 1 4 15V7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3.5 13.9 9l5.6 2-5.6 2L12 18.5 10.1 13l-5.6-2 5.6-2L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M18 16.5 19 19l2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <path d="M20 21v-1.5A4.5 4.5 0 0 0 15.5 15h-7A4.5 4.5 0 0 0 4 19.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
  }
}

/* ------------------------- Step content ------------------------ */

/** Step 1 — merged About YPP + Our Mission + Your Role. */
function WelcomeStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Welcome to Youth Passion Project</h2>
      <p>
        Youth Passion Project (YPP) is a student-led educational organization dedicated to connecting young learners with passionate peer instructors across hundreds of subjects.
      </p>
      <p className={styles.note}>
        <strong>Our mission:</strong> To Guide the Stars of Tomorrow. From Student, to Instructor, to Leadership, YPP&apos;s goal is to develop the next generation of educators and leaders from within.
      </p>

      <div className={styles.divider} />

      <p className={styles.subheading}>Our Numbers</p>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>3,200+</span>
          <span className={styles.statLabel}>students served</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>400+</span>
          <span className={styles.statLabel}>courses offered</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Instructors and students spanning multiple regions</span>
        </div>
      </div>

      <div className={styles.divider} />

      <h3 className={styles.sectionHeading}>Your role as a YPP instructor</h3>
      <p>
        As a YPP instructor, your core responsibility is to deliver high-quality, engaging instruction to students in your area of expertise. You are representing a standard of excellence that YPP has built across thousands of student interactions.
      </p>
      <p className={styles.subheading}>Core Expectactions: </p>
      <ul className={styles.checkList}>
        {coreExpectations.map((item) => (
          <li key={item}>
            <span className={styles.checkBadge} aria-hidden>
              <Icon name="check" />
            </span>
            {item}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        You will receive a mentor who is a Senior or Lead Instructor with past experience at YPP. They will hold a kickoff meeting with you to go over all the aspects of the Instructor role and our expectations.
      </p>
    </div>
  );
}

/** Step 2 — inline profile form (ported from the retired wizard). */
function ProfileStep({
  profileData,
  onSaved,
  onBack,
}: {
  profileData?: InstructorProfileFormData | null;
  onSaved: () => void;
  onBack: () => void;
}) {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Set up your instructor profile</h2>
      <p>
        Help students and fellow instructors get to know you. This info is visible on your profile and helps with mentorship matching.
      </p>
      <InstructorProfileForm profileData={profileData} onSaved={onSaved} onBack={onBack} />
    </div>
  );
}

/** Step 3 — training is now lived in-context: the same mission-control journey
 *  the standalone page renders, embedded directly in the launchpad. */
function TrainingStep({ trainingModel }: { trainingModel?: TrainingHomeModel | null }) {
  if (!trainingModel) {
    return (
      <div className={styles.body}>
        <h2 className={styles.stepTitle}>Your Training Journey</h2>
        <p>
          Before your first session, you&apos;ll work through a short, guided training journey.
          It&apos;s temporarily unavailable here — open it on its own page to continue.
        </p>
        <ButtonLink href="/instructor-training" variant="secondary">
          Open Instructor Training →
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Your Training Journey</h2>
      <p>
        Three short phases get you teach-ready: run a great session, prove you&apos;re ready, then
        design your first lessons. Pick up right where you left off — your progress is saved as you
        go, and you can finish the launchpad and return here anytime.
      </p>
      <TrainingHome model={trainingModel} />
    </div>
  );
}

/** Step 4 — Phase-4 launch into the real, interactive dashboard tour. */
function TourStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Your guided portal tour</h2>
      <p>
        You&apos;re cleared to use the portal. When you finish, we&apos;ll drop you on your
        real dashboard and walk you through it live — spotlighting each area right
        where you&apos;ll use it. No mockups.
      </p>
      <div className={styles.tourLaunch}>
        <p className={styles.note} style={{ border: "none", background: "transparent", padding: 0 }}>
          The tour stops, in order:
        </p>
        <ol className={styles.tourLaunchList}>
          {portalItems.map((item, index) => {
            const [title, ...rest] = item.split(" — ");
            return (
              <li key={item}>
                <span aria-hidden>{index + 1}</span>
                <span>
                  <strong>{title}</strong>
                  {rest.length ? ` — ${rest.join(" — ")}` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className={styles.note}>
        Hit <strong>Finish &amp; go to portal</strong> below and the walkthrough starts
        automatically on your live dashboard. You can replay it anytime by adding
        <code> ?tour=1</code> to your dashboard URL.
      </p>
    </div>
  );
}

/* -------------------- Step 4 — Help & community -------------------- */

/** Step 4 — getting support: who to contact and how to show up for the
 *  community. Previously a persistent side panel; now a first-class step so
 *  every instructor reads it before being dropped into the portal. */
function CommunityStep() {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Help &amp; community</h2>
      <p>
        You are never doing this alone. Here is how to get unstuck quickly, and
        how to plug into the wider YPP community.
      </p>

      <div className={styles.helpSection}>
        <p className={styles.helpLead}>Community &amp; events</p>
        <p className={styles.helpText}>
          YPP is not just a teaching gig. You are part of a community of student educators who take this seriously, and we expect you to show up for it. Throughout the year we run socials, cross-chapter sessions, end-of-semester showcases, and leadership workshops. Attend them, and when you are ready, help lead them. See what is coming up{" "}
          <a href="https://www.youthpassionproject.org/programs/calendar" target="_blank" rel="noreferrer">
            on the calendar
          </a>
          .
        </p>
      </div>

      <div className={styles.helpSection}>
        <p className={styles.helpLead}>Your points of contact</p>
        <ul className={styles.helpContacts}>
          {contactLines.map((line) => {
            const match = line.match(emailRegex);
            const email = match?.[1];
            return (
              <li key={line}>
                {email ? (
                  <>
                    {line.slice(0, match!.index)}
                    <a href={`mailto:${email}`}>{email}</a>
                    {line.slice(match!.index! + email.length)}
                  </>
                ) : (
                  line
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------- Page ----------------------------- */

interface InstructorLaunchpadProps {
  userName?: string;
  profileData?: InstructorProfileFormData | null;
  initialJourney: InstructorJourneyState;
  trainingModel?: TrainingHomeModel | null;
}

export default function InstructorLaunchpad({
  profileData,
  initialJourney,
  trainingModel,
}: InstructorLaunchpadProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(initialJourney.currentStep);
  const [reachedIndex, setReachedIndex] = useState(initialJourney.currentStep);
  const [completed, setCompleted] = useState<boolean[]>(() => [
    initialJourney.welcomeComplete,
    initialJourney.profileComplete,
    // Reflect live training progress, not just the one-time journey flag, so the
    // rail step checks itself the moment training is actually complete.
    initialJourney.trainingComplete || trainingModel?.progress.trainingComplete === true,
    initialJourney.communityComplete,
    initialJourney.tourComplete,
  ]);
  const [finishing, setFinishing] = useState(false);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, LAUNCHPAD_STEP_COUNT - 1));
    setActiveIndex(next);
    setReachedIndex((prev) => Math.max(prev, next));
    void saveJourneyStep(next);
  }, []);

  const markComplete = useCallback((key: JourneyStepKey) => {
    const index = JOURNEY_STEP_ORDER.indexOf(key);
    setCompleted((prev) => {
      if (prev[index]) return prev;
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });
  }, []);

  const step = STEPS[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === LAUNCHPAD_STEP_COUNT - 1;

  // Welcome / Training advance: mark step complete server-side, then move on.
  const handleContinue = useCallback(() => {
    const key = STEPS[activeIndex].id;
    markComplete(key);
    void completeJourneyStep(key, activeIndex + 1);
    goTo(activeIndex + 1);
  }, [activeIndex, goTo, markComplete]);

  // Profile form saved itself (and stamped profile complete) — just advance.
  const handleProfileSaved = useCallback(() => {
    markComplete("profile");
    goTo(2);
  }, [goTo, markComplete]);

  const handleFinish = useCallback(() => {
    markComplete("tour");
    setFinishing(true);
    void (async () => {
      await completeJourneyStep("tour");
      await completeInstructorJourney();
      // Land on the real dashboard with the interactive Phase-4 tour armed.
      router.push("/?tour=1");
      router.refresh();
    })();
  }, [markComplete, router]);

  const completedCount = useMemo(() => completed.filter(Boolean).length, [completed]);
  const progressPercent = Math.round((completedCount / LAUNCHPAD_STEP_COUNT) * 100);

  return (
    <div className={styles.launchpad}>
      {/* ---------- Left vertical rail (desktop) ---------- */}
      <aside className={styles.rail}>
        <div className={styles.railHead}>
          <span className={styles.trailEyebrow}>Instructor Launchpad</span>
          <p className={styles.railProgressLabel}>{progressPercent}% complete</p>
        </div>
        <OnboardingStepper
          steps={STEPS}
          activeIndex={activeIndex}
          reachedIndex={reachedIndex}
          completed={completed}
          onSelect={goTo}
        />
      </aside>

      {/* ---------- Right pane: fixed header + scrollable content ---------- */}
      <div className={styles.main}>
        <header className={styles.mainHeader}>
          {/* Mobile compact pill + progress bar (below 720px) */}
          <div className={styles.mobilePill} aria-hidden>
            <span className={styles.mobilePillText}>
              Step {activeIndex + 1} of {LAUNCHPAD_STEP_COUNT} · {step.label}
            </span>
            <div className={styles.mobileProgress}>
              <span
                className={styles.mobileProgressFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>
                {step.kicker} · {step.eyebrow}
              </p>
              <h1 className={styles.title}>Instructor Launchpad</h1>
            </div>
            <span className={styles.progressMeta}>
              <strong>
                Step {activeIndex + 1} of {LAUNCHPAD_STEP_COUNT}
              </strong>
            </span>
          </div>
        </header>

        <div className={styles.contentScroll}>
          <section
            key={step.id}
            className={`${styles.stepCard} ${styles.animateIn}`}
            aria-labelledby="onboarding-step-eyebrow"
            aria-live="polite"
          >
            <div className={styles.stepHead}>
              <span className={styles.stepIcon} aria-hidden>
                <Icon name={step.icon} />
              </span>
              <p className={styles.eyebrow} id="onboarding-step-eyebrow">
                {step.kicker} · {step.eyebrow}
              </p>
            </div>

            {step.id === "welcome" && <WelcomeStep />}
            {step.id === "profile" && (
              <ProfileStep
                profileData={profileData}
                onSaved={handleProfileSaved}
                onBack={() => goTo(0)}
              />
            )}
            {step.id === "training" && <TrainingStep trainingModel={trainingModel} />}
            {step.id === "community" && <CommunityStep />}
            {step.id === "tour" && <TourStep />}

            {/* Profile step owns its own form buttons; others use the footer nav. */}
            {step.id !== "profile" && (
              <div className={styles.footerNav}>
                <span className={styles.footerHint}>
                  {isLast
                    ? "That's the full launchpad — jump into the portal."
                    : `Next up: ${STEPS[activeIndex + 1].label}`}
                </span>
                <div className={styles.footerActions}>
                  <Button
                    variant="secondary"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={isFirst}
                  >
                    Back
                  </Button>
                  {isLast ? (
                    <Button
                      variant="primary"
                      onClick={handleFinish}
                      loading={finishing}
                    >
                      {finishing ? "Finishing…" : "Finish & go to portal →"}
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={handleContinue}>
                      Continue →
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
