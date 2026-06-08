import Link from "next/link";

import type { MenteeMentorshipView } from "@/lib/mentorship-2/mentee-dashboard";
import { createMentorshipActionSeed } from "@/lib/action-tracker-3/mentorship-bridge";

/**
 * The mentee-facing "command center" rendered on /my-mentor when Mentorship 2.0
 * is enabled. Switches on the mentee's lifecycle state so the student always
 * knows where they stand and what their next step is. Presentational only —
 * never exposes internal mentor rankings.
 */
export function MenteeCommandCenter({ view }: { view: MenteeMentorshipView }) {
  switch (view.state) {
    case "none":
      return <NotAppliedPanel />;
    case "applied":
      return <AppliedPanel view={view} />;
    case "reviewing":
      return <ReviewingPanel view={view} />;
    case "matched":
      return <MatchedPanel view={view} />;
    case "completed":
      return <CompletedPanel view={view} />;
  }
}

// State A ---------------------------------------------------------------------

function NotAppliedPanel() {
  return (
    <section className="card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Find a mentor</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, maxWidth: "64ch" }}>
        A YPP mentor helps you set goals, build real skills, and grow as a
        leader. Apply with your goals and interests, and we&apos;ll match you with
        a mentor whose expertise fits.
      </p>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
        <li>You share your goals, interests, and the expertise you&apos;re after.</li>
        <li>A program lead reviews mentor fit and approves a match.</li>
        <li>You kick off with your mentor and start working toward your goals.</li>
      </ol>
      <div>
        <Link href="/my-mentor/apply" className="button">
          Apply for a mentor →
        </Link>
      </div>
      <ResourceLinks />
    </section>
  );
}

// State B ---------------------------------------------------------------------

function AppliedPanel({ view }: { view: MenteeMentorshipView }) {
  const app = view.application;
  return (
    <section className="card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Application received</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        {app?.createdAt
          ? `Submitted ${new Date(app.createdAt).toLocaleDateString()}. `
          : ""}
        We&apos;re reviewing mentor fit — nothing needed from you right now.
      </p>
      <StatusTimeline stage="applied" />
      {app && <SubmittedSummary app={app} />}
      <ResourceLinks />
    </section>
  );
}

// State C ---------------------------------------------------------------------

function ReviewingPanel({ view }: { view: MenteeMentorshipView }) {
  return (
    <section className="card" style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Your application is being reviewed</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, maxWidth: "64ch" }}>
        A program lead is finalizing your mentor match. Your mentor will appear
        here as soon as it&apos;s approved — usually within a few days.
      </p>
      <StatusTimeline stage="reviewing" />
      {view.application && <SubmittedSummary app={view.application} />}
      <ResourceLinks />
    </section>
  );
}

// State D ---------------------------------------------------------------------

function MatchedPanel({ view }: { view: MenteeMentorshipView }) {
  const matched = view.matched;
  const goalLine =
    view.goals.application || view.goals.careerGoal || view.goals.leadershipGoal;
  const needsKickoff = matched && !matched.kickoffCompletedAt;

  // Action Tracker 3.0 bridge: derive (non-persisted) suggested first steps.
  const seed = createMentorshipActionSeed({
    application: {
      goals: view.goals.application,
      careerGoal: view.goals.careerGoal,
      leadershipGoal: view.goals.leadershipGoal,
      interests: [],
    },
    mentorExpertise: matched?.mentorExpertise ?? [],
    mentorName: matched?.mentorName ?? null,
  });

  return (
    <section
      className="card"
      style={{ display: "grid", gap: 12, borderLeft: "4px solid var(--color-primary)" }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Your mentorship</h2>
      {matched?.mentorName && (
        <p style={{ margin: 0, fontSize: 14 }}>
          You&apos;re matched with <strong>{matched.mentorName}</strong>.
        </p>
      )}
      {matched && matched.mentorExpertise.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {matched.mentorExpertise.map((e) => (
            <span key={e.slug} className="pill" style={{ fontSize: 11 }}>
              {e.name}
            </span>
          ))}
        </div>
      )}
      {goalLine && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Your goal:</span> {goalLine}
        </p>
      )}

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>{needsKickoff ? "Before your first meeting" : "Suggested first steps"}</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {seed.firstSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ul>
      </div>

      <ResourceLinks />
    </section>
  );
}

// State E ---------------------------------------------------------------------

function CompletedPanel({ view }: { view: MenteeMentorshipView }) {
  const alumni = view.alumni;
  return (
    <section
      className="card"
      style={{ display: "grid", gap: 12, borderLeft: "4px solid var(--color-success, #2f855a)" }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>Mentorship complete 🎓</h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
        Congratulations — you&apos;ve completed your mentorship
        {alumni ? " and joined the YPP Alumni network" : ""}. Your growth journey
        continues from here.
      </p>
      {alumni && (alumni.graduationYear || alumni.college) && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          {[alumni.college, alumni.graduationYear].filter(Boolean).join(" · ")}
        </p>
      )}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "10px 12px",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <strong>Reflect on how far you&apos;ve come.</strong> Look back at your
        achievement journey and capture what changed.{" "}
        <Link href="/my-program/achievement-journey">Open your achievement journey →</Link>
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>Next leadership step:</span> explore where
        you can grow next on the{" "}
        <Link href="/leadership-pathway">Leadership Pathway →</Link>
      </p>
      <ResourceLinks emphasizeCertificate />
    </section>
  );
}

// Shared ----------------------------------------------------------------------

function SubmittedSummary({
  app,
}: {
  app: NonNullable<MenteeMentorshipView["application"]>;
}) {
  if (!app.goals && app.interests.length === 0 && app.preferredExpertise.length === 0) {
    return null;
  }
  return (
    <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
      <span style={{ fontWeight: 600, fontSize: 12, color: "var(--muted)" }}>
        What you submitted
      </span>
      {app.goals && <p style={{ margin: 0 }}>{app.goals}</p>}
      {app.interests.length > 0 && (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Interests: {app.interests.join(", ")}
        </p>
      )}
      {app.preferredExpertise.length > 0 && (
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Seeking: {app.preferredExpertise.join(", ")}
        </p>
      )}
    </div>
  );
}

function StatusTimeline({ stage }: { stage: "applied" | "reviewing" }) {
  const steps = [
    { key: "applied", label: "Submitted" },
    { key: "reviewing", label: "Reviewing mentor fit" },
    { key: "matched", label: "Matched" },
  ];
  const activeIndex = stage === "applied" ? 0 : 1;
  return (
    <ol
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        fontSize: 12,
      }}
    >
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const current = i === activeIndex;
        return (
          <li
            key={s.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: current ? 700 : 400,
              color: done || current ? "var(--text)" : "var(--muted)",
            }}
          >
            <span aria-hidden>{done ? "✓" : current ? "●" : "○"}</span>
            {s.label}
            {i < steps.length - 1 && (
              <span aria-hidden style={{ color: "var(--muted)" }}>
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResourceLinks({ emphasizeCertificate }: { emphasizeCertificate?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        paddingTop: 4,
        borderTop: "1px solid var(--border)",
      }}
    >
      <Link href="/my-mentor/goals" className="button secondary small">
        Goals &amp; Resources
      </Link>
      <Link href="/my-program/achievement-journey" className="button secondary small">
        Achievement journey
      </Link>
      <Link
        href="/my-program/certificate"
        className={emphasizeCertificate ? "button small" : "button secondary small"}
      >
        Certificate
      </Link>
    </div>
  );
}
