import styles from "./instructor-onboarding-guide.module.css";

/* ------------------------------------------------------------------
   Static "lay of the land" map — the Phase 1 (day one) orientation.

   Day-one instructors haven't unlocked the portal yet, so instead of
   touring locked areas we show a calm, static overview of the four
   places they'll spend their time. The real, interactive guided tour
   of these areas runs later (Phase 4) on the live dashboard.
   ------------------------------------------------------------------ */

const AREAS: { title: string; desc: string }[] = [
  {
    title: "Dashboard",
    desc: "Your home base — upcoming sessions, what needs attention, and your week at a glance.",
  },
  {
    title: "Course Materials",
    desc: "Curriculum, lesson plans, and resources for every class you teach.",
  },
  {
    title: "Session Logging",
    desc: "After each session, record attendance and what you covered.",
  },
  {
    title: "Mentorship & Community",
    desc: "Your mentor, fellow instructors, events, and your growth record.",
  },
];

export default function StaticPortalMap() {
  return (
    <div className={styles.mapWrap}>
      <p className={styles.mapCaption}>
        A quick lay of the land — the four places you&apos;ll spend your time. Once
        you&apos;re approved, we&apos;ll walk you through each one, live, right where you&apos;ll
        use it.
      </p>
      <ol className={styles.map}>
        {AREAS.map((area, index) => (
          <li key={area.title} className={styles.mapArea}>
            <span className={styles.mapNum} aria-hidden>
              {index + 1}
            </span>
            <div>
              <p className={styles.mapAreaTitle}>{area.title}</p>
              <p className={styles.mapAreaDesc}>{area.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
