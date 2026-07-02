import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import ReflectionForm from "@/app/(app)/my-program/reflect/reflection-form";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { ButtonLink, CardV2, PageHeaderV2 } from "@/components/ui-v2";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";

export const metadata = { title: "Reflection — My development" };

export default async function ReflectionPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const [mentorship, goals] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { cycleNumber: true },
        },
      },
    }),
    prisma.mentorshipProgramGoal.findMany({
      where: { roleType: menteeRoleType, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true },
    }),
  ]);

  if (!mentorship) {
    const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return (
      <div className={`${skin.portalSkin} flex flex-col gap-6`}>
        <PageHeaderV2
          eyebrow="Mentorship · My development"
          title="Monthly reflection"
          subtitle="Your self-input — the honest first word that starts each monthly review."
        />
        <MyMentorSubnav />
        <CardV2 padding="lg" className="text-center">
          <p className="m-0 text-[15px] font-semibold text-ink">No reflection open yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-ink-muted">
            Reflections open at the start of each month once you&apos;re matched with a
            mentor. There&apos;s nothing you need to do right now — we&apos;ll let you know
            when {monthLabel}&apos;s reflection is ready.
          </p>
          <div className="mt-4">
            <ButtonLink href="/mentorship?view=me" variant="secondary" size="sm">
              ← Back to My development
            </ButtonLink>
          </div>
        </CardV2>
      </div>
    );
  }

  const lastCycle = mentorship.selfReflections[0]?.cycleNumber ?? 0;
  const cycleNumber = lastCycle + 1;
  const isQuarterly = cycleNumber % 3 === 0;

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · My development"
        title="Monthly reflection"
        subtitle={`Cycle ${cycleNumber}${isQuarterly ? " (Quarterly)" : ""} · ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} — your self-input starts the monthly review loop.`}
        actions={
          <ButtonLink href="/mentorship?view=me" variant="ghost" size="sm">
            Cancel
          </ButtonLink>
        }
      />

      <MyMentorSubnav />

      <CardV2 padding="md" className="border-l-4 border-l-brand-600">
        <p className="m-0 text-[13px] text-ink">
          <strong>This is for you and your mentor.</strong> Be honest about what&apos;s
          going well and what&apos;s hard — it helps your mentor support you better. Your
          mentor reads this before writing your monthly review.
        </p>
      </CardV2>

      <ReflectionForm goals={goals} cycleNumber={cycleNumber} isQuarterly={isQuarterly} />
    </div>
  );
}
