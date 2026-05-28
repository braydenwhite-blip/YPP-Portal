import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import {
  getEligibleMentees,
  getNominationQueue,
} from "@/lib/award-nomination-actions";
import NominationsPanel from "@/app/(app)/mentorship-program/awards/nominations-panel";

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

      <NominationsPanel
        eligibleMentees={eligibleMentees ?? []}
        nominations={nominations ?? []}
        isAdmin={roles.includes("ADMIN")}
      />
    </div>
  );
}
