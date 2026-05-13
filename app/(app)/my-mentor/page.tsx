import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import { RoleIdentityCard } from "@/components/leadership-pathway/role-identity-card";
import { MentorCard } from "@/components/leadership-pathway/mentor-card";
import { MenteesOverview } from "@/components/leadership-pathway/mentees-overview";
import { WorkshopPathwayCallout } from "@/components/leadership-pathway/workshop-pathway-callout";
import { StageRibbon } from "@/components/leadership-pathway/stage-ribbon";

export const metadata = {
  title: "My Mentor — YPP",
  description: "Your mentor, your role, and where you're heading at YPP.",
};

export default async function MyMentorPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  if (!ctx) redirect("/");

  const showMenteeFlow = !!ctx.primaryMentor;
  const showMentorFlow = ctx.mentees.length > 0;
  const isWorkshop = ctx.user.instructorSubtype === "SUMMER_WORKSHOP";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Leadership pipeline</p>
          <h1 className="page-title">My Mentor</h1>
          <p className="page-subtitle">
            Who you&apos;re growing with at YPP, and where you&apos;re heading next.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/leadership-pathway" className="button secondary small">
            View leadership pathway →
          </Link>
          {showMenteeFlow && (
            <Link href="/mentorship" className="button small">
              Open mentorship hub
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <StageRibbon currentStageId={ctx.stageId} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <RoleIdentityCard
            stageId={ctx.stageId}
            nextStageId={ctx.nextStageId}
          />
          {showMenteeFlow && ctx.primaryMentor && (
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
        </div>

        {!showMenteeFlow && !showMentorFlow && (
          <div
            className="card"
            style={{ padding: "1.75rem", textAlign: "center" }}
          >
            <h2 style={{ margin: "0 0 8px" }}>
              You&apos;re not yet paired with a mentor.
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 560,
                color: "var(--muted)",
                lineHeight: 1.55,
              }}
            >
              Once your mentorship pairing is in place, you&apos;ll see your
              mentor here along with how often you connect, what
              you&apos;re working on together, and what role comes next.
              Reach out to your chapter leadership if you need a match.
            </p>
          </div>
        )}

        {isWorkshop && <WorkshopPathwayCallout isCurrentWorkshopInstructor />}

        {showMentorFlow && (
          <div className="card" style={{ padding: 18 }}>
            <MenteesOverview mentees={ctx.mentees} />
          </div>
        )}

        <div
          className="card"
          style={{
            padding: 16,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            How mentorship flows at YPP
          </div>
          <ul
            style={{
              margin: "8px 0 0",
              paddingLeft: 18,
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--text)",
              display: "grid",
              gap: 4,
            }}
          >
            <li>
              Instructors are mentored by Senior Instructors, Lead
              Instructors, or Chapter Presidents.
            </li>
            <li>
              Senior Instructors are mentored by Lead Instructors or
              Chapter Presidents.
            </li>
            <li>
              Lead Instructors are mentored by the global leadership team.
            </li>
          </ul>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              color: "var(--muted)",
              fontStyle: "italic",
            }}
          >
            Mentorship at YPP is about growing leaders — not just checking
            in. Your mentor is investing in who you&apos;re becoming.
          </p>
        </div>
      </div>
    </div>
  );
}
