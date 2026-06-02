"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./instructor-onboarding-guide.module.css";

const sections = [
  { id: "about", label: "About" },
  { id: "mission", label: "Mission" },
  { id: "role", label: "Role" },
  { id: "community", label: "Community" },
  { id: "contacts", label: "Contacts" },
  { id: "portal-walkthrough", label: "Walkthrough" },
  { id: "first-steps", label: "First Steps" },
  { id: "training-modules", label: "Training" },
] as const;

type SectionId = (typeof sections)[number]["id"];

const coreExpectations = [
  "Deliver organized, engaging classes using approved curriculum that keeps students participating and coming back",
  "Build strong, supportive relationships with students and families through professional and responsive communication",
  "Respond to all messages within 24 hours, attend every required meeting, and show up to every class prepared and on time",
  "Participate actively in the YPP community — events, trainings, and building relationships with fellow instructors go beyond the minimum",
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

type IconName =
  | "book"
  | "calendar"
  | "check"
  | "compass"
  | "message"
  | "spark"
  | "target"
  | "users";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
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

function SectionCard({
  id,
  icon,
  children,
  className,
}: {
  id: string;
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={[styles.sectionCard, className].filter(Boolean).join(" ")}>
      {icon ? (
        <div className={styles.sectionIcon}>
          <Icon name={icon} />
        </div>
      ) : null}
      {children}
    </section>
  );
}

function ProgressNav({
  activeSection,
  scrollProgress,
}: {
  activeSection: SectionId;
  scrollProgress: number;
}) {
  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  return (
    <nav className={styles.progressNav} aria-label="Instructor onboarding sections">
      <div
        className={styles.progressRail}
        style={{ "--guide-progress": `${scrollProgress}%` } as React.CSSProperties}
        aria-hidden
      />
      <p className={styles.progressTitle}>Guide progress</p>
      <ol className={styles.progressList}>
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              onClick={(event) => handleClick(event, section.id)}
              className={activeSection === section.id ? styles.activeProgressLink : undefined}
              aria-current={activeSection === section.id ? "location" : undefined}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {section.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Callout({
  number,
  label,
  x,
  y,
}: {
  number: number;
  label: string;
  x: number;
  y: number;
}) {
  return (
    <div className={styles.callout} style={{ left: `${x}%`, top: `${y}%` }}>
      <span>{number}</span>
      {label}
    </div>
  );
}

function ScreenshotFrame({
  title,
  description,
  variant,
  callouts,
}: {
  title: string;
  description: string;
  variant: "login" | "dashboard" | "materials" | "logging" | "training";
  callouts: Array<{ number: number; label: string; x: number; y: number }>;
}) {
  return (
    <figure className={styles.screenshotFrame}>
      <div className={styles.screenshotHeader}>
        <div className={styles.windowDots} aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span>{title}</span>
      </div>
      <div className={[styles.screenshotCanvas, styles[`screenshotCanvas_${variant}`]].join(" ")}>
        <div className={styles.mockSidebar} aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.mockMain} aria-hidden>
          <div className={styles.mockTopBar} />
          <div className={styles.mockHeroLine} />
          <div className={styles.mockGrid}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.mockWidePanel} />
        </div>
        {callouts.map((callout) => (
          <Callout key={`${title}-${callout.number}`} {...callout} />
        ))}
      </div>
      <figcaption>{description}</figcaption>
    </figure>
  );
}

function PortalWalkthroughFrames() {
  return (
    <div className={styles.walkthroughFrames}>
      <ScreenshotFrame
        title="Portal login placeholder"
        description="Swap this frame with a real login screenshot when it is ready."
        variant="login"
        callouts={[
          { number: 1, label: "Complete this", x: 53, y: 42 },
          { number: 2, label: "Click here", x: 62, y: 67 },
        ]}
      />
      <ScreenshotFrame
        title="Dashboard placeholder"
        description="Shows the first portal screen after sign in."
        variant="dashboard"
        callouts={[
          { number: 1, label: "Review this", x: 43, y: 35 },
          { number: 2, label: "Open this tab", x: 18, y: 47 },
        ]}
      />
      <ScreenshotFrame
        title="Course materials placeholder"
        description="Use this frame for curriculum resources and lesson plans."
        variant="materials"
        callouts={[
          { number: 1, label: "Open this tab", x: 19, y: 55 },
          { number: 2, label: "Click here", x: 67, y: 36 },
        ]}
      />
      <ScreenshotFrame
        title="Session logging placeholder"
        description="Use this frame for attendance, covered topics, and notes."
        variant="logging"
        callouts={[
          { number: 1, label: "Complete this", x: 52, y: 49 },
          { number: 2, label: "Submit log", x: 70, y: 75 },
        ]}
      />
      <ScreenshotFrame
        title="Training modules placeholder"
        description="Use this frame for required onboarding videos and readings."
        variant="training"
        callouts={[
          { number: 1, label: "Open this tab", x: 18, y: 64 },
          { number: 2, label: "Complete this", x: 61, y: 42 },
        ]}
      />
    </div>
  );
}

export default function InstructorOnboardingGuide() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>(sections[0].id);
  const [scrollProgress, setScrollProgress] = useState(0);

  const sectionIds = useMemo(() => sections.map((section) => section.id), []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const updateScroll = () => {
      const page = pageRef.current;
      if (!page) return;

      const rect = page.getBoundingClientRect();
      const scrollable = Math.max(page.offsetHeight - window.innerHeight, 1);
      const distance = Math.min(Math.max(-rect.top, 0), scrollable);
      const progress = Math.min(Math.max((distance / scrollable) * 100, 0), 100);

      setScrollProgress(progress);
      if (!reducedMotion.matches) {
        page.style.setProperty("--parallax-hero", `${Math.min(distance * 0.11, 84)}px`);
        page.style.setProperty("--parallax-soft", `${Math.min(distance * 0.055, 48)}px`);
      }
    };

    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        const nextId = visible?.target.id as SectionId | undefined;
        if (nextId && sectionIds.includes(nextId)) {
          setActiveSection(nextId);
        }
      },
      {
        rootMargin: "-18% 0px -56% 0px",
        threshold: [0.12, 0.35, 0.6],
      },
    );

    sectionIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  return (
    <div ref={pageRef} className={styles.page}>
      <div className={styles.parallaxBackdrop} aria-hidden>
        <span className={styles.backdropPlaneOne} />
        <span className={styles.backdropPlaneTwo} />
      </div>

      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>Youth Passion Project Instructor Onboarding Guide</h1>
          <div className={styles.heroActions} aria-label="Guide shortcuts">
            <a href="#about" className={styles.primaryAction}>
              Start Guide
            </a>
            <a href="#portal-walkthrough" className={styles.secondaryAction}>
              Portal Walkthrough
            </a>
          </div>
        </div>
        <div className={styles.heroVisual} aria-hidden>
          <div className={styles.heroPanel}>
            <div className={styles.heroPanelHeader}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.heroPanelBody}>
              <div />
              <div />
              <div />
            </div>
          </div>
          <div className={styles.heroChecklist}>
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <SectionCard id="about" icon="spark">
            <h2>About Youth Passion Project: </h2>
            <p>
              Youth Passion Project (YPP) is a student-led educational organization dedicated to connecting young learners with passionate peer instructors across hundreds of subjects.
            </p>
            <div className={styles.metricsBlock} aria-labelledby="our-numbers-heading">
              <h3 id="our-numbers-heading">Our Numbers</h3>
              <div className={styles.metricsGrid}>
                <p><strong>3,200+</strong> students served</p>
                <p><strong>400+</strong> courses offered</p>
                <p>Instructors and students spanning multiple regions</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="mission" icon="target" className={styles.missionCard}>
            <h2>Our Mission: </h2>
            <p>
              To Guide the Stars of Tomorrow. From Student, to Instructor, to Leadership, YPP&apos;s goal is to develop the next generation of educators and leaders from within.
            </p>
          </SectionCard>

          <SectionCard id="role" icon="book">
            <h2>Your Role as a YPP Instructor: </h2>
            <p>
              As a YPP instructor, your core responsibility is to deliver high-quality, engaging instruction to students in your area of expertise. You are representing a standard of excellence that YPP has built across thousands of student interactions.
            </p>
            <div className={styles.expectationsPanel}>
              <h3>Core Expectactions: </h3>
              <ul className={styles.expectationsList}>
                {coreExpectations.map((item) => (
                  <li key={item}>
                    <span aria-hidden><Icon name="check" /></span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <p className={styles.mentorNote}>
              You will receive a mentor who is a Senior or Lead Instructor with past experience at YPP. They will hold a kickoff meeting with you to go over all the aspects of the Instructor role and our expectations.
            </p>
          </SectionCard>

          <SectionCard id="community" icon="users">
            <h2>Community &amp; Events</h2>
            <p>
              YPP is not just a teaching gig. You are part of a community of student educators who take this seriously, and we expect you to show up for it. Throughout the year we run socials, cross-chapter sessions, end-of-semester showcases, and leadership workshops. Attend them, and when you are ready, help lead them. See what is coming up here:{" "}
              <a href="https://www.youthpassionproject.org/programs/calendar" target="_blank" rel="noreferrer">
                https://www.youthpassionproject.org/programs/calendar
              </a>
            </p>
          </SectionCard>

          <SectionCard id="contacts" icon="message">
            <h2>Your Points of Contact</h2>
            <p>
              YPP is led by an officer team of students from around the country, reporting to a board of directors comprising the organization&apos;s founders, legal representatives, and seasoned advisors. The whole team is here to help you.
            </p>
            <ul className={styles.contactList}>
              {contactLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard id="portal-walkthrough" icon="compass" className={styles.walkthroughCard}>
            <h2>Portal Walkthrough: </h2>
            <p>
              You are seeing this in our portal. Assuming you were able to sign up and login, this is what you will see after the onboarding process:
            </p>
            <div className={styles.portalItemGrid}>
              {portalItems.map((item, index) => (
                <div key={item} className={styles.portalItem}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
            <PortalWalkthroughFrames />
          </SectionCard>

          <SectionCard id="first-steps" icon="check" className={styles.stepsCard}>
            <h2>First Steps After Logging In</h2>
            <ol className={styles.stepsList}>
              {firstSteps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard id="training-modules" icon="calendar">
            <h2>Training Modules</h2>
            <p>
              Before your first session, you are required to complete the following training modules available in the portal.
            </p>
            <p>
              These modules will walk you through YPP&apos;s instructional standards, how to structure a session, how to work with students at different levels, and how to use the platform effectively.
            </p>
          </SectionCard>
        </div>

        <aside className={styles.sideColumn}>
          <ProgressNav activeSection={activeSection} scrollProgress={scrollProgress} />
        </aside>
      </div>
    </div>
  );
}
