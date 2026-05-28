import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import { MentorCard } from "@/components/leadership-pathway/mentor-card";
import { LEADERSHIP_STAGES } from "@/lib/leadership-pathway";
import { MenteeDashboard } from "@/app/(app)/mentorship/_components/mentee-dashboard";
import { MyMentorSubnav } from "./_components/my-mentor-subnav";

export const metadata = {
  title: "My Mentor — YPP",
};

export default async function MyMentorPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  if (!ctx) redirect("/");

  const stage = ctx.stageId ? LEADERSHIP_STAGES[ctx.stageId] : null;
  const nextStage = ctx.nextStageId ? LEADERSHIP_STAGES[ctx.nextStageId] : null;
  const hasMentor = !!ctx.primaryMentor;
  const mentorsOthers = ctx.mentees.length > 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">My Mentorship</h1>
          {stage && (
            <p
              className="page-subtitle"
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <span>{stage.label}</span>
              {nextStage && (
                <>
                  <span aria-hidden style={{ color: "var(--muted)" }}>→</span>
                  <span style={{ color: "var(--muted)" }}>{nextStage.label}</span>
                </>
              )}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/leadership-pathway" className="button secondary small">
            Pathway →
          </Link>
          {mentorsOthers && (
            <Link href="/mentorship" className="button small">
              Mentor Workspace →
            </Link>
          )}
        </div>
      </div>

      <MyMentorSubnav />

      <div style={{ display: "grid", gap: 24 }}>
        {mentorsOthers && (
          <div
            className="card"
            style={{
              borderLeft: "4px solid var(--color-primary)",
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                {hasMentor
                  ? "You\u2019re also mentoring others."
                  : "You mentor others in YPP."}
              </strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
                Your mentor workspace stays separate so this page can focus on
                your own support.
              </p>
            </div>
            <Link href="/mentorship" className="button secondary small">
              Open Mentor Workspace
            </Link>
          </div>
        )}

        {hasMentor && ctx.primaryMentor && (
          <div style={{ maxWidth: 760 }}>
            <MentorCard
              mentor={{
                name: ctx.primaryMentor.name,
                email: ctx.primaryMentor.email,
                phone: ctx.primaryMentor.phone,
                roleLabel: ctx.primaryMentor.roleLabel,
                stageId: ctx.primaryMentor.stage?.id ?? null,
                chapterName: ctx.primaryMentor.chapterName,
                mentorshipId: ctx.primaryMentor.mentorshipId,
                trackName: ctx.primaryMentor.trackName,
                kickoffCompletedAt: ctx.primaryMentor.kickoffCompletedAt,
                lastSessionAt: ctx.primaryMentor.lastSessionAt,
              }}
              menteeStageId={ctx.stageId}
            />
          </div>
        )}

        {!hasMentor && (
          <div
            style={{
              padding: "32px 24px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              You&apos;re not yet paired with a mentor.
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 440,
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              Reach out to chapter leadership to get matched. Until then, the
              pathway page shows how mentorship flows at YPP.
            </p>
          </div>
        )}

        {hasMentor && <MenteeDashboard userId={session.user.id} />}
      </div>
    </div>
  );
}
