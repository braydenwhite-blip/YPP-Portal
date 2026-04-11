import { useId } from "react";

type StudentJourneyVisualProps = {
  age: number | null;
  chapterName?: string | null;
  firstName: string;
  grade?: number | null;
  interests: string[];
  learningStyle?: string | null;
  primaryGoal?: string | null;
  school?: string | null;
};

type JourneyMilestone = {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  icon: "class" | "xp" | "events" | "passion" | "instructor" | "leader";
  top: string;
  left: string;
};

/** Order and copy aligned to the “Your Journey with YPP” roadmap artwork. */
const JOURNEY_MILESTONES: JourneyMilestone[] = [
  {
    id: "first-class",
    title: "Take Your First Class",
    body: "Get started by joining your first class and earn XP!",
    icon: "class",
    top: "74%",
    left: "12%",
  },
  {
    id: "instructor",
    title: "Become an Instructor",
    body: "Share your knowledge by teaching your own classes!",
    icon: "instructor",
    top: "62%",
    left: "68%",
  },
  {
    id: "passion",
    title: "Find Your Passion Area",
    body: "Explore different topics to find what excites you the most!",
    icon: "passion",
    top: "48%",
    left: "14%",
  },
  {
    id: "events",
    title: "Join YPP Events",
    body: "Attend special events to meet other students and mentors!",
    icon: "events",
    top: "38%",
    left: "62%",
  },
  {
    id: "earn-xp",
    title: "Earn XP",
    body: "Level up and gain XP by taking classes and getting involved.",
    icon: "xp",
    top: "24%",
    left: "20%",
  },
  {
    id: "leader",
    title: "Become a Leader",
    body: "Take on more responsibility and help guide others!",
    icon: "leader",
    top: "10%",
    left: "58%",
  },
] as const;

function JourneyIcon({ icon }: { icon: JourneyMilestone["icon"] }) {
  switch (icon) {
    case "class":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 7.5 12 3l10 4.5-10 4.5L2 7.5Z" />
          <path d="M6 10.5V15c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5" />
        </svg>
      );
    case "xp":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
    case "events":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4v3" />
          <path d="M17 4v3" />
          <rect x="3" y="6.5" width="18" height="14" rx="2" />
          <path d="M3 10.5h18" />
          <path d="m8 14 2 2 5-5" />
        </svg>
      );
    case "passion":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21c-4.4-2.3-7-5.7-7-9.4A4.6 4.6 0 0 1 9.6 7c1 0 1.9.3 2.4 1 .5-.7 1.4-1 2.4-1A4.6 4.6 0 0 1 19 11.6c0 3.7-2.6 7.1-7 9.4Z" />
        </svg>
      );
    case "instructor":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
          <path d="M18 6h4" />
          <path d="M20 4v4" />
        </svg>
      );
    case "leader":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 2.4 5 5.6.7-4.1 3.8 1 5.5-4.9-2.7L7 18l1-5.5L3.9 8.7 9.5 8 12 3Z" />
          <path d="M8 21h8" />
        </svg>
      );
    default:
      return null;
  }
}

export default function StudentJourneyVisual({
  age,
  chapterName,
  firstName,
  grade,
  interests,
  learningStyle,
  primaryGoal,
  school,
}: StudentJourneyVisualProps) {
  const journeyFilterId = useId();
  const journeyGlowId = `journeyGlow-${journeyFilterId.replace(/:/g, "")}`;
  const journeyStrokeId = `journeyStroke-${journeyFilterId.replace(/:/g, "")}`;

  const profileHighlights = [
    school ? `${school}` : null,
    grade ? `Grade ${grade}` : null,
    age ? `Age ${age}` : null,
    chapterName ? `${chapterName} chapter` : null,
    primaryGoal ? `Goal: ${primaryGoal}` : null,
    learningStyle ? `Best fit: ${learningStyle}` : null,
    ...interests.map((interest) => interest),
  ].filter(Boolean) as string[];

  return (
    <div className="student-journey-panel">
      <div className="student-journey-heading">
        <p className="student-journey-kicker">Your YPP journey</p>
        <h2>
          {firstName}, this is where one class can turn into something much bigger.
        </h2>
        <p>
          You do not need to have everything figured out today. Start with one step, keep showing up,
          and let your path get clearer as you grow.
        </p>
      </div>

      {profileHighlights.length > 0 ? (
        <div className="student-journey-summary" aria-label="Your profile summary">
          {profileHighlights.map((highlight) => (
            <span key={highlight} className="student-journey-summary-pill">
              {highlight}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="student-journey-visual"
        aria-label={`${firstName}'s YPP journey map: Your Journey with YPP`}
      >
        <div className="student-journey-stars" aria-hidden="true" />
        <div className="student-journey-planet" aria-hidden="true" />
        <div className="student-journey-atmosphere" aria-hidden="true" />

        <svg className="student-journey-path" viewBox="0 0 1000 1400" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id={journeyGlowId}>
              <feGaussianBlur stdDeviation="8" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={journeyStrokeId} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255, 213, 255, 0.72)" />
              <stop offset="50%" stopColor="rgba(248, 202, 255, 0.98)" />
              <stop offset="100%" stopColor="rgba(255, 241, 253, 0.85)" />
            </linearGradient>
          </defs>
          <path
            d="M120 1210C280 1110 490 1140 655 1050C790 980 820 900 675 845C515 785 250 815 175 705C100 596 415 610 610 525C785 450 835 360 675 285C540 220 420 255 345 212"
            className="student-journey-path-glow"
            filter={`url(#${journeyGlowId})`}
          />
          <path
            d="M120 1210C280 1110 490 1140 655 1050C790 980 820 900 675 845C515 785 250 815 175 705C100 596 415 610 610 525C785 450 835 360 675 285C540 220 420 255 345 212"
            className="student-journey-path-core"
            stroke={`url(#${journeyStrokeId})`}
          />
          <g className="student-journey-path-flag" transform="translate(325 198)">
            <line x1="20" y1="8" x2="20" y2="52" stroke="rgba(255,255,255,0.9)" strokeWidth="3.5" strokeLinecap="round" />
            <path
              d="M20 12h22l-3 9 3 9H20V12z"
              fill="rgba(255,255,255,0.97)"
              style={{ filter: "drop-shadow(0 0 10px rgba(255, 230, 255, 0.9))" }}
            />
          </g>
        </svg>

        <div className="student-journey-node-grid" aria-hidden="true">
          {JOURNEY_MILESTONES.map((milestone) => (
            <article
              key={milestone.id}
              className="student-journey-node"
              style={{ top: milestone.top, left: milestone.left }}
            >
              <div className="student-journey-node-orb">
                <JourneyIcon icon={milestone.icon} />
              </div>
              <div className="student-journey-node-copy">
                {milestone.subtitle ? <p>{milestone.subtitle}</p> : null}
                <h3>{milestone.title}</h3>
                <span>{milestone.body}</span>
              </div>
            </article>
          ))}
        </div>

        <ol className="sr-only">
          {JOURNEY_MILESTONES.map((milestone, index) => (
            <li key={milestone.id}>
              Step {index + 1}: {milestone.title}. {milestone.body}
            </li>
          ))}
        </ol>

        <ol className="student-journey-mobile-list">
          {JOURNEY_MILESTONES.map((milestone, index) => (
            <li key={milestone.id} className="student-journey-mobile-item">
              <div className="student-journey-mobile-step">{index + 1}</div>
              <div className="student-journey-mobile-copy">
                {milestone.subtitle ? <p>{milestone.subtitle}</p> : null}
                <h3>{milestone.title}</h3>
                <span>{milestone.body}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
