import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  canAccessMentorship,
  getInstructorMentorshipMembership,
} from "@/lib/mentorship-access";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  getMentorDashboard,
  type MentorDashboardMentee,
} from "@/lib/mentorship-2/mentor-dashboard";

export const metadata = { title: "Mentor dashboard — YPP" };

export default async function MentorDashboardPage() {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id: userId, primaryRole, roles = [] } = session.user;
  if (!canAccessMentorship(primaryRole ?? "")) redirect("/");

  const isAdmin = roles.includes("ADMIN");
  const membership = await getInstructorMentorshipMembership(userId);
  if (!membership.isMentor && !isAdmin) redirect("/mentorship");

  const dashboard = await getMentorDashboard(userId);
  const { capacity, expertise, hasAvailability, mentees } = dashboard;
  const activeMentees = mentees.filter((m) => m.status === "ACTIVE");
  const otherMentees = mentees.filter((m) => m.status !== "ACTIVE");

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Mentor dashboard</h1>
          <p className="page-subtitle">
            Who you&apos;re mentoring, what they need, and your next move.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/mentorship" className="button secondary small">
            Mentor Workspace →
          </Link>
          <Link href="/mentorship/expertise" className="button secondary small">
            Update expertise →
          </Link>
        </div>
      </div>

      {/* Capacity + expertise summary */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          marginBottom: 24,
        }}
      >
        <section className="card" style={{ display: "grid", gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 14 }}>Capacity</h2>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            {capacity.activeLoad}
            {capacity.capacity != null && (
              <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)" }}>
                {" "}
                / {capacity.capacity}
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>
              {" "}
              active mentees
            </span>
          </p>
          {capacity.capacity == null ? (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Capacity not set — add a target in your profile so matching can
              weigh your availability.
            </p>
          ) : capacity.atCapacity ? (
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-warning, #b7791f)" }}>
              At capacity — new matches will rank you lower.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              {capacity.openSlots} open slot{capacity.openSlots === 1 ? "" : "s"}.
            </p>
          )}
        </section>

        <section className="card" style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 14 }}>Your expertise</h2>
            <Link href="/mentorship/expertise" className="button secondary small">
              Edit
            </Link>
          </div>
          {expertise.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {expertise.map((e) => (
                <span key={e.slug} className="pill" style={{ fontSize: 11 }}>
                  {e.name}
                  {e.proficiencyLabel ? ` · ${e.proficiencyLabel}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              No expertise declared yet. Add areas so mentees can be matched to
              you.
            </p>
          )}
          {!hasAvailability && (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
              Tip: add your availability in your profile to improve match quality.
            </p>
          )}
        </section>
      </div>

      {/* Mentee roster */}
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>
        Your mentees{" "}
        <span className="muted" style={{ fontWeight: 400 }}>
          ({mentees.length})
        </span>
      </h2>

      {mentees.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          You&apos;re not mentoring anyone yet. Once an admin approves a match,
          your mentees appear here.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {activeMentees.map((m) => (
            <MenteeCard key={m.mentorshipId} mentee={m} />
          ))}
          {otherMentees.length > 0 && (
            <>
              <h3 style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)" }}>
                Paused &amp; completed
              </h3>
              {otherMentees.map((m) => (
                <MenteeCard key={m.mentorshipId} mentee={m} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenteeCard({ mentee }: { mentee: MentorDashboardMentee }) {
  const goalLine =
    mentee.goals || mentee.careerGoal || mentee.leadershipGoal || null;
  return (
    <section
      className="card"
      style={{
        display: "grid",
        gap: 8,
        opacity: mentee.status === "COMPLETE" ? 0.85 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>{mentee.menteeName ?? mentee.menteeEmail}</strong>
          <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 12 }}>
            {mentee.status.toLowerCase()}
            {mentee.lastActivityAt
              ? ` · last activity ${new Date(mentee.lastActivityAt).toLocaleDateString()}`
              : " · no activity yet"}
          </p>
        </div>
        <Link
          href={`/mentorship/mentees/${mentee.menteeId}`}
          className="button secondary small"
        >
          Open mentee →
        </Link>
      </div>

      {goalLine && (
        <p style={{ margin: 0, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Goal:</span> {goalLine}
        </p>
      )}
      {mentee.preferredExpertise.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Seeking: {mentee.preferredExpertise.join(", ")}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          background: "var(--surface)",
          borderLeft: "3px solid var(--color-primary)",
          padding: "6px 10px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Next: {mentee.nextAction.label}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {mentee.nextAction.detail}
        </span>
      </div>
    </section>
  );
}
