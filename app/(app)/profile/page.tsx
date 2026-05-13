import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { getProfilePageData } from "@/lib/profile-page-data";
import { getLeadershipContext } from "@/lib/leadership-context";
import ProfileMain from "@/components/profile/profile-main";
import { RoleIdentityCard } from "@/components/leadership-pathway/role-identity-card";
import { MentorCard } from "@/components/leadership-pathway/mentor-card";
import { MenteesOverview } from "@/components/leadership-pathway/mentees-overview";
import { StageRibbon } from "@/components/leadership-pathway/stage-ribbon";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.primaryRole === "INSTRUCTOR") {
    redirect("/settings/personalization");
  }

  const [user, leadership] = await Promise.all([
    getProfilePageData(session.user.id),
    getLeadershipContext(session.user.id),
  ]);

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((r) => r.role);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Profile</p>
          <h1 className="page-title">My Profile</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>
          {roles.join(" · ")}
        </div>
      </div>

      {leadership && leadership.stageId && (
        <section style={{ display: "grid", gap: 14, marginBottom: 18 }}>
          <StageRibbon currentStageId={leadership.stageId} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
              alignItems: "start",
            }}
          >
            <RoleIdentityCard
              stageId={leadership.stageId}
              nextStageId={leadership.nextStageId}
            />
            {leadership.primaryMentor && (
              <MentorCard
                mentor={{
                  name: leadership.primaryMentor.name,
                  email: leadership.primaryMentor.email,
                  phone: leadership.primaryMentor.phone,
                  roleLabel: leadership.primaryMentor.roleLabel,
                  stageId: leadership.primaryMentor.stage?.id ?? null,
                  chapterName: leadership.primaryMentor.chapterName,
                  mentorshipId: leadership.primaryMentor.mentorshipId,
                  trackName: leadership.primaryMentor.trackName,
                  kickoffCompletedAt:
                    leadership.primaryMentor.kickoffCompletedAt,
                  lastSessionAt: leadership.primaryMentor.lastSessionAt,
                }}
                menteeStageId={leadership.stageId}
              />
            )}
          </div>
          {leadership.mentees.length > 0 && (
            <div className="card" style={{ padding: 18 }}>
              <MenteesOverview mentees={leadership.mentees} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/leadership-pathway" className="button secondary small">
              View full leadership pathway →
            </Link>
            <Link href="/my-mentor" className="button secondary small">
              Open my mentor page →
            </Link>
          </div>
        </section>
      )}

      <ProfileMain user={user} />
    </div>
  );
}
