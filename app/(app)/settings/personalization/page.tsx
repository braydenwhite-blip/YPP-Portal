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

      {leadership && leadership.stageId && (
        <section
          className={styles.section}
          aria-labelledby="leadership-heading"
        >
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Role &amp; growth</span>
            <h2 id="leadership-heading" className={styles.sectionTitle}>
              Your role at YPP
            </h2>
            <p className={styles.sectionDesc}>
              Where you are in the YPP leadership pipeline, who&apos;s
              mentoring you, and how to see what&apos;s next.
            </p>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
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
              <Link href="/my-program/gr" className="button secondary small">
                Open my Goals &amp; Resources →
              </Link>
            </div>
          </div>
        </section>
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
