"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./instructor-onboarding-guide.module.css";

interface Callout {
  num: number;
  label: string;
  x: number;
  y: number;
}

interface TourStop {
  /** Short title shown in the rail and frame bar. */
  title: string;
  /** Mock URL shown in the frame's address pill. */
  url: string;
  /** Real portal destination this stop maps to. */
  href: string;
  /** Action label for the "open in portal" CTA. */
  action: string;
  /** Which mock sidebar row is highlighted (0-indexed). */
  activeNav: number;
  callouts: Callout[];
}

/**
 * Four guided stops mapped to real portal destinations. The copy that
 * describes each destination still comes from `portalItems` (kept verbatim);
 * these stops add the "go here → do this" guidance layer around it.
 */
const TOUR: TourStop[] = [
  {
    title: "Your Dashboard",
    url: "portal / home",
    href: "/",
    action: "Open Dashboard",
    activeNav: 0,
    callouts: [
      { num: 1, label: "Review action items", x: 46, y: 40 },
      { num: 2, label: "See upcoming sessions", x: 60, y: 74 },
    ],
  },
  {
    title: "Course Materials",
    url: "portal / my-courses",
    href: "/my-courses",
    action: "Open Course Materials",
    activeNav: 1,
    callouts: [
      { num: 1, label: "Open your course", x: 22, y: 47 },
      { num: 2, label: "Lesson plans & resources", x: 62, y: 40 },
    ],
  },
  {
    title: "Session Logging",
    url: "portal / my-classes",
    href: "/my-classes",
    action: "Open Session Logging",
    activeNav: 2,
    callouts: [
      { num: 1, label: "Mark attendance", x: 50, y: 45 },
      { num: 2, label: "Submit your log", x: 66, y: 76 },
    ],
  },
  {
    title: "Training Modules",
    url: "portal / instructor-training",
    href: "/instructor-training",
    action: "Open Training Modules",
    activeNav: 3,
    callouts: [
      { num: 1, label: "Start a module", x: 23, y: 64 },
      { num: 2, label: "Track completion", x: 60, y: 42 },
    ],
  },
];

function PortalArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MockFrame({ stop }: { stop: TourStop }) {
  return (
    <figure className={styles.frame}>
      <div className={styles.frameBar}>
        <span className={styles.frameDots} aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span>{stop.title}</span>
        <span className={styles.frameUrl}>{stop.url}</span>
      </div>
      <div className={styles.frameCanvas}>
        <div className={styles.mockSidebar} aria-hidden>
          {[0, 1, 2, 3, 4].map((row) => (
            <span key={row} className={row === stop.activeNav ? styles.mockActive : undefined} />
          ))}
        </div>
        <div className={styles.mockMain} aria-hidden>
          <div className={styles.mockTopline} />
          <div className={styles.mockHero} />
          <div className={styles.mockTiles}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.mockWide} />
        </div>
        {stop.callouts.map((callout) => (
          <span
            key={callout.num}
            className={styles.callout}
            style={{ left: `${callout.x}%`, top: `${callout.y}%` }}
          >
            <span className={styles.calloutNum}>{callout.num}</span>
            {callout.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Interactive portal tour: pick a destination on the left, see a polished
 * portal mock with numbered "go here → do this" callouts on the right, and
 * jump straight into the real portal surface via the CTA.
 *
 * @param portalItems verbatim onboarding copy describing each destination.
 */
export default function PortalWalkthrough({ portalItems }: { portalItems: readonly string[] }) {
  const [active, setActive] = useState(0);
  const stop = TOUR[active];

  return (
    <div className={styles.tour}>
      <ol className={styles.tourRail}>
        {TOUR.map((item, index) => (
          <li key={item.title}>
            <button
              type="button"
              className={`${styles.tourStop} ${index === active ? styles.tourActive : ""}`}
              onClick={() => setActive(index)}
              aria-pressed={index === active}
            >
              <span className={styles.tourNum}>{index + 1}</span>
              <span className={styles.tourStopText}>
                <strong>{item.title}</strong>
                {item.action}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.tourPreview}>
        <MockFrame stop={stop} />
        <div className={styles.tourCaption}>
          <p>
            Step {active + 1} of {TOUR.length} — follow the numbered callouts, then jump in.
          </p>
          <Link href={stop.href} className="btn btn-primary btn-sm">
            {stop.action}
            <PortalArrow />
          </Link>
        </div>
        {/* Verbatim destination descriptions, kept exactly as written. */}
        <ul className={styles.portalItems}>
          {portalItems.map((item, index) => (
            <li key={item} className={styles.portalItem}>
              <span className={styles.tourNum}>{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
