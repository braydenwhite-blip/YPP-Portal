import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getProfilePageData } from "@/lib/profile-page-data";
import { getLeadershipContext } from "@/lib/leadership-context";
import ProfileMain from "@/components/profile/profile-main";
import { RoleStrip } from "@/components/leadership-pathway/role-strip";
import PersonalizationSettingsClient from "./personalization-settings-client";
import styles from "./personalization-page.module.css";

export default async function PersonalizationPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
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
    <div className={styles.layout}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className="badge">Settings</p>
          <h1 className="page-title">Profile &amp; Settings</h1>
          <p className={styles.heroSub}>
            Manage your account details, profile, and portal preferences in one place.
          </p>
        </div>
        <div className={`dashboard-role-pill ${styles.rolePill}`}>{roles.join(" · ")}</div>
      </header>

      {leadership?.stageId && (
        <div style={{ margin: "0 0 8px" }}>
          <RoleStrip
            stageId={leadership.stageId}
            nextStageId={leadership.nextStageId}
            mentorName={leadership.primaryMentor?.name ?? null}
            mentorRoleLabel={leadership.primaryMentor?.roleLabel ?? null}
          />
        </div>
      )}

      <section className={styles.section} aria-labelledby="account-heading">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Account</span>
          <h2 id="account-heading" className={styles.sectionTitle}>
            Profile &amp; identity
          </h2>
          <p className={styles.sectionDesc}>
            Name, contact information, photo, bio, and role-specific fields. Save each section with its button when
            you are done editing.
          </p>
        </div>
        <ProfileMain user={user} layoutVariant="settings" />
      </section>

      <section className={styles.section} aria-labelledby="preferences-heading" id="portal-preferences">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Experience</span>
          <h2 id="preferences-heading" className={styles.sectionTitle}>
            Portal preferences
          </h2>
          <p className={styles.sectionDesc}>
            Tune dashboard layout, content, and privacy-style options. These controls are local to your session until
            wired to persistent storage.
          </p>
        </div>
        <PersonalizationSettingsClient />
      </section>
    </div>
  );
}
