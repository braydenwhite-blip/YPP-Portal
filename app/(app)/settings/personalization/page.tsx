import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getProfilePageData } from "@/lib/profile-page-data";
import ProfileMain from "@/components/profile/profile-main";
import PersonalizationSettingsClient from "./personalization-settings-client";

export default async function PersonalizationPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
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
          <p className="badge">Settings</p>
          <h1 className="page-title">Profile &amp; Settings</h1>
        </div>
        <div className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>{roles.join(" · ")}</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          Profile
        </h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14, maxWidth: 640 }}>
          Your account details, photo, and school information. The same content as{" "}
          <Link href="/profile" className="link">
            My Profile
          </Link>
          .
        </p>
      </div>

      <ProfileMain user={user} />

      <h2 className="section-title" style={{ margin: "40px 0 16px" }}>
        Portal preferences
      </h2>

      <PersonalizationSettingsClient />
    </div>
  );
}
