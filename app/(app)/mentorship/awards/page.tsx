import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import { PageHeaderV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import {
  getEligibleMentees,
  getNominationQueue,
} from "@/lib/award-nomination-actions";
import NominationsPanel from "@/app/(app)/mentorship-program/awards/nominations-panel";
import { LearnMore } from "@/components/mentorship/learn-more";

export const metadata = { title: "Awards — Mentorship" };

export default async function MentorshipAwardsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  const canUseAwards =
    roles.includes("ADMIN") ||
    roles.includes("MENTOR") ||
    roles.includes("CHAPTER_PRESIDENT");

  if (!canUseAwards) {
    redirect("/mentorship?view=me");
  }

  const [eligibleMentees, nominations] = await Promise.all([
    getEligibleMentees(),
    getNominationQueue(),
  ]);

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Awards"
        subtitle="Nominate mentees and review achievement award approvals using the existing points and tier system."
        backHref="/mentorship"
        backLabel="Mentorship"
      />

      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
          Awards recognize a mentee&apos;s growth along their leadership pathway — they
          don&apos;t replace their goals or your monthly feedback.
        </p>

        <LearnMore summary="How your reviews affect recognition">
          <ul className="m-0 grid gap-1 pl-[1.1rem] text-[0.83rem]">
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
