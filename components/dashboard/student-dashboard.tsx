import Link from "next/link";
import type { StudentProgressSnapshot } from "@/lib/student-progress-actions";
import type { ActivePathwaySummary } from "@/lib/dashboard/types";
import s from "./student-dashboard.module.css";

export interface StudentHomeNextSession {
  classTitle: string;
  topic: string;
  dateLabel: string;
  timeLabel: string;
  isToday: boolean;
  classHref: string;
  zoomLink: string | null;
  instructorName: string;
}

interface StudentDashboardProps {
  firstName: string;
  greeting: string;
  todayDateLabel: string;
  unreadMessages: number;
  unreadNotifications: number;
  snapshot: StudentProgressSnapshot | null;
  nextSession: StudentHomeNextSession | null;
  pathways: ActivePathwaySummary[];
}

export default function StudentDashboard({
  firstName,
  greeting,
  todayDateLabel,
  unreadMessages,
  unreadNotifications,
  snapshot,
  nextSession,
  pathways,
}: StudentDashboardProps) {
  const name = firstName.trim() || "there";

  const checklistItems = snapshot
    ? [
        {
          done: snapshot.checklist.profileCompleted,
          label: "Complete your profile",
          hint: "Share your goals and interests so we can tailor what you see.",
          href: "/settings/personalization",
        },
        {
          done: snapshot.checklist.joinedFirstClass,
          label: "Join your first class",
          hint: "Browse classes built around what you're curious about.",
          href: "/curriculum",
        },
        {
          done: snapshot.checklist.submittedFirstAssignment,
          label: "Submit your first assignment",
          hint: "Open a class to see what's due and turn in your work.",
          href: "/my-classes/assignments",
        },
        {
          done: snapshot.checklist.checkedInAtLeastOnce,
          label: "Check in to a session",
          hint: "Check in when you attend so your progress stays current.",
          href: "/my-classes",
        },
      ]
    : [];
  const checklistDone = checklistItems.filter((item) => item.done).length;
  const showChecklist =
    checklistItems.length > 0 && checklistDone < checklistItems.length;

  const stats = snapshot
    ? [
        {
          icon: "🎓",
          value: snapshot.activeEnrollments,
          label: "Active classes",
          href: "/my-classes",
          urgent: false,
        },
        {
          icon: "📝",
          value: snapshot.dueAssignmentsNext7Days,
          label: "Due this week",
          href: "/my-classes/assignments",
          urgent: snapshot.dueAssignmentsNext7Days > 0,
        },
        {
          icon: "📅",
          value: snapshot.upcomingSessionsNext7Days,
          label: "Sessions this week",
          href: "/curriculum/schedule",
          urgent: false,
        },
        {
          icon: "🧭",
          value: snapshot.nextPathwaySteps,
          label: "Pathway steps",
          href: "/pathways/progress",
          urgent: false,
        },
      ]
    : [];

  const quickLinks = [
    { icon: "🎯", title: "Goals", href: "/goals" },
    { icon: "🏘️", title: "My chapter", href: "/my-chapter" },
    { icon: "✉️", title: "Messages", href: "/messages" },
    { icon: "🗓️", title: "Calendar", href: "/calendar" },
  ];

  const hasClasses = (snapshot?.activeEnrollments ?? 0) > 0;

  return (
    <div className={s.home}>
      <div className="topbar topbar-dashboard">
        <div>
          <h1 className="dashboard-page-title">
            {greeting}, <span className="dashboard-welcome-name">{name}</span>
          </h1>
          <p className="dashboard-header-date">
            <span className="dashboard-header-role">Student</span>
            <span className="dashboard-header-sep" aria-hidden>
              {" · "}
            </span>
            {todayDateLabel}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <Link
            href="/messages"
            className={`dashboard-header-icon-btn${unreadMessages > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadMessages > 0
                ? `Messages, ${unreadMessages > 99 ? "99+" : unreadMessages} unread`
                : "Messages"
            }
          >
            {"✉"}
          </Link>
          <Link
            href="/notifications"
            className={`dashboard-header-icon-btn${unreadNotifications > 0 ? " has-unread" : ""}`}
            aria-label={
              unreadNotifications > 0
                ? `Notifications, ${unreadNotifications > 99 ? "99+" : unreadNotifications} unread`
                : "Notifications"
            }
          >
            {"🔔"}
          </Link>
        </div>
      </div>

      <section className={s.hero} aria-labelledby="home-hero-title">
        {nextSession ? (
          <>
            <div className={s.heroKickerRow}>
              <span className={s.heroKicker}>Your next class</span>
              {nextSession.isToday ? (
                <span className={s.heroTodayPill}>Today</span>
              ) : null}
            </div>
            <h2 id="home-hero-title" className={s.heroTitle}>
              {nextSession.classTitle}
            </h2>
            <p className={s.heroMeta}>
              {nextSession.dateLabel} · {nextSession.timeLabel}
              {nextSession.instructorName
                ? ` · with ${nextSession.instructorName}`
                : ""}
            </p>
            {nextSession.topic ? (
              <p className={s.heroText}>{nextSession.topic}</p>
            ) : null}
            <div className={s.heroActions}>
              <Link href={nextSession.classHref} className={s.heroBtn}>
                Open class
              </Link>
              {nextSession.zoomLink ? (
                <a
                  href={nextSession.zoomLink}
                  target="_blank"
                  rel="noreferrer"
                  className={s.heroBtnGhost}
                >
                  Join on Zoom
                </a>
              ) : null}
            </div>
          </>
        ) : hasClasses ? (
          <>
            <span className={s.heroKicker}>You&apos;re on track</span>
            <h2 id="home-hero-title" className={s.heroTitle}>
              Nice momentum, {name}.
            </h2>
            <p className={s.heroText}>
              No class sessions in the next 7 days. Check what&apos;s due, or
              discover a new class to keep building.
            </p>
            <div className={s.heroActions}>
              <Link href="/my-classes" className={s.heroBtn}>
                My classes
              </Link>
              <Link href="/curriculum" className={s.heroBtnGhost}>
                Browse classes
              </Link>
            </div>
          </>
        ) : (
          <>
            <span className={s.heroKicker}>Welcome to YPP</span>
            <h2 id="home-hero-title" className={s.heroTitle}>
              Let&apos;s find your first class, {name}.
            </h2>
            <p className={s.heroText}>
              Explore classes built around what you&apos;re curious about — pick
              one that excites you and you&apos;ll be set up in minutes.
            </p>
            <div className={s.heroActions}>
              <Link href="/curriculum" className={s.heroBtn}>
                Browse classes
              </Link>
              <Link href="/my-chapter" className={s.heroBtnGhost}>
                Visit my chapter
              </Link>
            </div>
          </>
        )}
      </section>

      {stats.length > 0 ? (
        <section className={s.statGrid} aria-label="Your week at a glance">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className={`${s.statTile}${stat.urgent ? ` ${s.statTileUrgent}` : ""}`}
            >
              <span className={s.statIcon} aria-hidden>
                {stat.icon}
              </span>
              <span className={s.statValue}>{stat.value}</span>
              <span className={s.statLabel}>{stat.label}</span>
            </Link>
          ))}
        </section>
      ) : null}

      {showChecklist ? (
        <section className={s.section} aria-labelledby="home-setup-title">
          <div className={s.checklistCard}>
            <div className={s.checklistHead}>
              <div>
                <h2 id="home-setup-title" className={s.checklistTitle}>
                  Get set up
                </h2>
                <p className={s.checklistSub}>
                  A few quick steps to unlock the full YPP experience.
                </p>
              </div>
              <span className={s.checklistCount}>
                {checklistDone} of {checklistItems.length}
              </span>
            </div>
            <div
              className={s.checklistBar}
              role="progressbar"
              aria-valuenow={checklistDone}
              aria-valuemin={0}
              aria-valuemax={checklistItems.length}
              aria-label="Setup progress"
            >
              <div
                className={s.checklistBarFill}
                style={{
                  width: `${(checklistDone / checklistItems.length) * 100}%`,
                }}
              />
            </div>
            <ul className={s.checklist}>
              {checklistItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={`${s.checklistRow}${item.done ? ` ${s.checklistRowDone}` : ""}`}
                  >
                    <span
                      className={`${s.checklistCheck}${item.done ? ` ${s.checklistCheckDone}` : ""}`}
                      aria-hidden
                    >
                      {item.done ? "✓" : ""}
                    </span>
                    <span className={s.checklistBody}>
                      <span className={s.checklistLabel}>{item.label}</span>
                      <span className={s.checklistHint}>{item.hint}</span>
                    </span>
                    {!item.done ? (
                      <span className={s.checklistArrow} aria-hidden>
                        ›
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {pathways.length > 0 ? (
        <section className={s.section} aria-labelledby="home-pathways-title">
          <div className={s.sectionHead}>
            <h2 id="home-pathways-title" className={s.sectionTitle}>
              Your pathways
            </h2>
            <Link href="/my-chapter" className={s.sectionLink}>
              View all ›
            </Link>
          </div>
          <div className={s.pathwayList}>
            {pathways.map((pathway) => {
              const done = pathway.progressPercent >= 100;
              return (
                <Link
                  key={pathway.id}
                  href="/my-chapter"
                  className={s.pathwayCard}
                >
                  <div className={s.pathwayTop}>
                    <div>
                      <span className={s.pathwayName}>{pathway.name}</span>
                      <span className={s.pathwayArea}>
                        {pathway.interestArea}
                      </span>
                    </div>
                    <span
                      className={`${s.pathwayPct}${done ? ` ${s.pathwayPctDone}` : ""}`}
                    >
                      {pathway.progressPercent}%
                    </span>
                  </div>
                  <div
                    className={s.pathwayBar}
                    role="progressbar"
                    aria-valuenow={pathway.progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${pathway.name} progress`}
                  >
                    <div
                      className={`${s.pathwayBarFill}${done ? ` ${s.pathwayBarFillDone}` : ""}`}
                      style={{ width: `${pathway.progressPercent}%` }}
                    />
                  </div>
                  <span className={s.pathwaySteps}>
                    {pathway.completedCount}/{pathway.totalCount} steps
                    {pathway.nextStepTitle && !done
                      ? ` · Next: ${pathway.nextStepTitle}`
                      : ""}
                    {done ? " · Complete 🎉" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className={s.section} aria-labelledby="home-explore-title">
        <h2 id="home-explore-title" className={s.sectionTitle}>
          Explore
        </h2>
        <div className={s.quickGrid}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className={s.quickLink}>
              <span className={s.quickIcon} aria-hidden>
                {link.icon}
              </span>
              <span className={s.quickTitle}>{link.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
