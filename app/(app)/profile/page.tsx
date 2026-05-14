import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getProfilePageData } from "@/lib/profile-page-data";
import { getLeadershipContext } from "@/lib/leadership-context";
import ProfileMain from "@/components/profile/profile-main";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";

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

      {leadership?.stageId && (
        <div style={{ marginBottom: 16 }}>
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        </div>
      )}

      <ProfileMain user={user} />
    </div>
  );
}
