import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  getEligibleMentees,
  getNominationQueue,
} from "@/lib/award-nomination-actions";
import NominationsPanel from "@/app/(app)/mentorship-program/awards/nominations-panel";
import { LearnMore } from "@/components/mentorship/learn-more";

export const metadata = { title: "Mentorship Awards — YPP" };

export default async function MentorshipAwardsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const canUseAwards =
    roles.includes("ADMIN") ||
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_PRESIDENT");

  if (!canUseAwards) {
    redirect("/my-mentor");
  }

  const [eligibleMentees, nominations] = await Promise.all([
    getEligibleMentees(),
    getNominationQueue(),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/mentorship" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Mentorship
          </Link>
          <p className="badge">Mentorship</p>
          <h1 className="page-title">Awards</h1>
          <p className="page-subtitle">
            Nominate mentees and review achievement award approvals using the
            existing points and tier system.
          </p>
        </div>
      </div>

      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, maxWidth: "64ch" }}>
        Awards recognize a mentee&apos;s growth along their leadership pathway — they
        don&apos;t replace their goals or your monthly feedback.
      </p>

      <div style={{ marginBottom: 16 }}>
        <LearnMore summary="How your reviews affect recognition">
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.83rem", display: "grid", gap: 4 }}>
            <li>
              The <strong>overall rating</strong> you set on a monthly review determines the base
              achievement points for that cycle. A Character &amp; Culture bonus can add a few more.
            </li>
            <li>
              Points and award progress are <strong>not final until a chair approves</strong> the
              review. Until then they show as pending and the mentee sees nothing.
            </li>
            <li>
              Reaching a tier creates a nomination here. Confirm it so the mentee&apos;s award is
              recognized — Gold and Lifetime also need board approval.
            </li>
          </ul>
        </LearnMore>
      </div>

      <NominationsPanel
        eligibleMentees={eligibleMentees ?? []}
        nominations={nominations ?? []}
        isAdmin={roles.includes("ADMIN")}
      />
    </div>
  );
}
