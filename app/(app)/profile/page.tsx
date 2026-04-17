import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getProfilePageData } from "@/lib/profile-page-data";
import ProfileMain from "@/components/profile/profile-main";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.primaryRole === "INSTRUCTOR") {
    redirect("/settings/personalization");
  }

  const user = await getProfilePageData(session.user.id);

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

      <ProfileMain user={user} />
    </div>
  );
}
