import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import { MentorCard } from "@/components/leadership-pathway/mentor-card";
import { MenteesOverview } from "@/components/leadership-pathway/mentees-overview";
import { LEADERSHIP_STAGES } from "@/lib/leadership-pathway";

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
          <h1 className="page-title">My Mentor</h1>
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
          {hasMentor && (
            <Link href="/mentorship" className="button small">
              Mentorship hub →
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 24, maxWidth: 760 }}>
        {hasMentor && ctx.primaryMentor && (
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
        )}

        {!hasMentor && !mentorsOthers && (
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
              Reach out to chapter leadership to get matched. Until then,
              the pathway page shows how mentorship flows at YPP.
            </p>
          </div>
        )}

        {mentorsOthers && <MenteesOverview mentees={ctx.mentees} />}
      </div>
    </div>
  );
}
