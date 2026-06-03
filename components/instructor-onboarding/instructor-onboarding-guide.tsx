"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./instructor-onboarding-guide.module.css";
import OnboardingStepper, { type OnboardingStep } from "./onboarding-stepper";
import PortalWalkthrough from "./portal-walkthrough";

/* ------------------------------------------------------------------
   Onboarding copy — kept EXACTLY as written in the original guide.
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
  "Training Modules — Required onboarding videos and readings (see Section 4 below)",
];

const firstSteps = [
  "Complete your instructor profile (name, subject areas, availability)",
  "Review your assigned courses and upcoming sessions",
  "Complete all required training modules before your first session",
  "Confirm your first session date with your chapter president",
];

/** Real portal destinations each first step points at. */
const firstStepActions: { href: string; label: string }[] = [
  { href: "/profile", label: "Open profile" },
  { href: "/my-courses", label: "Review courses" },
  { href: "/instructor-training", label: "Open training" },
  { href: "/chapter", label: "Go to chapter" },
];

/* ---------------------------- Steps ---------------------------- */

type StepId =
  | "about"
  | "mission"
  | "role"
  | "community"
  | "contacts"
  | "walkthrough"
  | "first-steps"
  | "training";

type IconName =
  | "spark"
  | "target"
  | "book"
  | "users"
  | "message"
  | "compass"
  | "check"
  | "calendar";

interface StepDef extends OnboardingStep {
  id: StepId;
  eyebrow: string;
  icon: IconName;
}

const STEPS: StepDef[] = [
  { id: "about", label: "About YPP", kicker: "Step 1", eyebrow: "Orientation", icon: "spark" },
  { id: "mission", label: "Our Mission", kicker: "Step 2", eyebrow: "Why we exist", icon: "target" },
  { id: "role", label: "Your Role", kicker: "Step 3", eyebrow: "Expectations", icon: "book" },
  { id: "community", label: "Community", kicker: "Step 4", eyebrow: "Belonging", icon: "users" },
  { id: "contacts", label: "Contacts", kicker: "Step 5", eyebrow: "Where to get help", icon: "message" },
  { id: "walkthrough", label: "Walkthrough", kicker: "Step 6", eyebrow: "Guided portal tour", icon: "compass" },
  { id: "first-steps", label: "First Steps", kicker: "Step 7", eyebrow: "Your action checklist", icon: "check" },
  { id: "training", label: "Training", kicker: "Step 8", eyebrow: "Before your first session", icon: "calendar" },
];

const STORAGE_KEY = "ypp.instructor-onboarding.step";

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
    case "book":
      return (
        <svg {...common}>
          <path d="M5 5.5C5 4.67 5.67 4 6.5 4H20v15H6.5A2.5 2.5 0 0 1 4 16.5v-11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 7.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
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
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M9.5 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 11.5a3 3 0 1 0-.6-5.9M17 15a5.2 5.2 0 0 1 4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
  }
}

/* ------------------------- Step content ------------------------ */

function AboutStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>About Youth Passion Project: </h2>
      <p>
        Youth Passion Project (YPP) is a student-led educational organization dedicated to connecting young learners with passionate peer instructors across hundreds of subjects.
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
    </div>
  );
}

function MissionStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Our Mission: </h2>
      <p>
        To Guide the Stars of Tomorrow. From Student, to Instructor, to Leadership, YPP&apos;s goal is to develop the next generation of educators and leaders from within.
      </p>
    </div>
  );
}

function RoleStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Your Role as a YPP Instructor: </h2>
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

function CommunityStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Community &amp; Events</h2>
      <p>
        YPP is not just a teaching gig. You are part of a community of student educators who take this seriously, and we expect you to show up for it. Throughout the year we run socials, cross-chapter sessions, end-of-semester showcases, and leadership workshops. Attend them, and when you are ready, help lead them. See what is coming up here:{" "}
        <a href="https://www.youthpassionproject.org/programs/calendar" target="_blank" rel="noreferrer">
          https://www.youthpassionproject.org/programs/calendar
        </a>
      </p>
    </div>
  );
}

/** Map each verbatim contact line to a scannable support card icon + a mailto. */
function ContactsStep() {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Your Points of Contact</h2>
      <p>
        YPP is led by an officer team of students from around the country, reporting to a board of directors comprising the organization&apos;s founders, legal representatives, and seasoned advisors. The whole team is here to help you.
      </p>
      <div className={styles.contactGrid}>
        {contactLines.map((line) => {
          const match = line.match(emailRegex);
          const email = match?.[1];
          return (
            <div key={line} className={styles.contactCard}>
              <span className={styles.contactIcon} aria-hidden>
                <Icon name="message" />
              </span>
              <p>
                {email ? (
                  <>
                    {line.slice(0, match!.index)}
                    <a href={`mailto:${email}`}>{email}</a>
                    {line.slice(match!.index! + email.length)}
                  </>
                ) : (
                  line
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WalkthroughStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Portal Walkthrough: </h2>
      <p>
        You are seeing this in our portal. Assuming you were able to sign up and login, this is what you will see after the onboarding process:
      </p>
      <PortalWalkthrough portalItems={portalItems} />
    </div>
  );
}

function FirstStepsStep() {
  const [done, setDone] = useState<boolean[]>(() => firstSteps.map(() => false));
  const completed = done.filter(Boolean).length;

  const toggle = (index: number) =>
    setDone((prev) => prev.map((value, i) => (i === index ? !value : value)));

  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>First Steps After Logging In</h2>
      <div className={styles.taskSummary}>
        <Icon name="check" />
        <span>
          {completed} of {firstSteps.length} complete
        </span>
      </div>
      <ul className={styles.taskList}>
        {firstSteps.map((step, index) => {
          const action = firstStepActions[index];
          return (
            <li key={step} className={`${styles.taskItem} ${done[index] ? styles.taskDone : ""}`}>
              <button
                type="button"
                className={styles.taskCheck}
                onClick={() => toggle(index)}
                aria-pressed={done[index]}
                aria-label={done[index] ? `Mark "${step}" as not done` : `Mark "${step}" as done`}
              >
                <Icon name="check" />
              </button>
              <span className={styles.taskLabel}>{step}</span>
              {action ? (
                <Link href={action.href} className={styles.taskAction}>
                  {action.label} →
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrainingStep() {
  return (
    <div className={styles.body}>
      <h2 className={styles.stepTitle}>Training Modules</h2>
      <p>
        Before your first session, you are required to complete the following training modules available in the portal.
      </p>
      <p>
        These modules will walk you through YPP&apos;s instructional standards, how to structure a session, how to work with students at different levels, and how to use the platform effectively.
      </p>
    </div>
  );
}

function StepContent({ id }: { id: StepId }) {
  switch (id) {
    case "about":
      return <AboutStep />;
    case "mission":
      return <MissionStep />;
    case "role":
      return <RoleStep />;
    case "community":
      return <CommunityStep />;
    case "contacts":
      return <ContactsStep />;
    case "walkthrough":
      return <WalkthroughStep />;
    case "first-steps":
      return <FirstStepsStep />;
    case "training":
      return <TrainingStep />;
  }
}

/* -------------------- Parallax (subtle, opt-out) -------------------- */

function useStageParallax(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const onPointer = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const mx = (event.clientX - rect.left) / rect.width - 0.5;
      const my = (event.clientY - rect.top) / rect.height - 0.5;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        el.style.setProperty("--mx", mx.toFixed(3));
        el.style.setProperty("--my", my.toFixed(3));
      });
    };

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const offset = rect.top - window.innerHeight / 2;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        el.style.setProperty("--scroll", offset.toFixed(1));
      });
    };

    el.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ref]);
}

/* ----------------------------- Page ----------------------------- */

export default function InstructorOnboardingGuide() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reachedIndex, setReachedIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  useStageParallax(stageRef);

  // Restore the furthest step the instructor previously reached.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isInteger(saved) && saved > 0 && saved < STEPS.length) {
        setActiveIndex(saved);
        setReachedIndex(saved);
      }
    } catch {
      /* localStorage unavailable — start fresh */
    }
  }, []);

  const goTo = useCallback((index: number) => {
    const next = Math.max(0, Math.min(index, STEPS.length - 1));
    setActiveIndex(next);
    setReachedIndex((prev) => Math.max(prev, next));
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
    // Keep the active step in view, just below the sticky header.
    const top = (headerRef.current?.offsetTop ?? 0) - 12;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }, []);

  const step = STEPS[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === STEPS.length - 1;

  return (
    <div className={styles.guide}>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.trail}>
          <span className={styles.trailEyebrow}>Instructor onboarding</span>
          <span className={styles.trailDivider}>/</span>
          <span>{step.label}</span>
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Youth Passion Project Instructor Onboarding Guide</h1>
          <span className={styles.progressMeta}>
            <strong>
              Step {activeIndex + 1} of {STEPS.length}
            </strong>
          </span>
        </div>
        <OnboardingStepper
          steps={STEPS}
          activeIndex={activeIndex}
          reachedIndex={reachedIndex}
          onSelect={goTo}
        />
      </header>

      <div className={styles.stage} ref={stageRef}>
        <div className={styles.stageLayers} aria-hidden>
          <span className={`${styles.orb} ${styles.orbOne}`} />
          <span className={`${styles.orb} ${styles.orbTwo}`} />
          <span className={`${styles.plane} ${styles.planeOne}`} />
          <span className={`${styles.plane} ${styles.planeTwo}`} />
        </div>

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
            <div>
              <p className={styles.eyebrow} id="onboarding-step-eyebrow">
                {step.kicker} · {step.eyebrow}
              </p>
            </div>
          </div>

          <StepContent id={step.id} />

          <div className={styles.footerNav}>
            <span className={styles.footerHint}>
              {isLast
                ? "That's the full onboarding journey — jump into the portal below."
                : `Next up: ${STEPS[activeIndex + 1].label}`}
            </span>
            <div className={styles.footerActions}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => goTo(activeIndex - 1)}
                disabled={isFirst}
              >
                Back
              </button>
              {isLast ? (
                <Link href="/instructor-training" className="btn btn-primary">
                  Go to Training Modules →
                </Link>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => goTo(activeIndex + 1)}>
                  Continue →
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
