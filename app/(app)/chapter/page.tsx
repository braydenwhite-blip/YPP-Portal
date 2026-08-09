import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, CardV2 } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter — Pathways Portal" };

export default async function ChapterHomePage() {
  const ctx = await getChapterViewerContext();

  // National leadership run every chapter from the command center, not a
  // single chapter home.
  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }

  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2 eyebrow="Chapter" title="Chapter" subtitle="Lead your YPP chapter from one place." />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your chapter home appears here."
            action={
              <ButtonLink href="/chapter/apply" variant="primary">
                Apply to start a chapter
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  const chapterId = ctx.ledChapterId;

  const [chapter, onboarding] = await Promise.all([
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { name: true },
    }),
    prisma.chapterPresidentOnboarding
      .findUnique({
        where: { userId: ctx.user.id },
        select: { status: true, metTeam: true, setChapterGoals: true, reviewedResources: true, introMessageSent: true },
      })
      .catch(() => null),
  ]);
  if (!chapter) redirect("/chapter/apply");

  const onboardingSteps = onboarding
    ? [onboarding.metTeam, onboarding.setChapterGoals, onboarding.reviewedResources, onboarding.introMessageSent]
    : [];
  const onboardingDone = onboardingSteps.filter(Boolean).length;
  const onboardingComplete = onboarding?.status === "COMPLETED" || (onboardingSteps.length > 0 && onboardingSteps.every(Boolean));
  const showOnboardingBanner = onboarding != null && !onboardingComplete;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeaderV2 eyebrow="Chapter" title={chapter.name} subtitle="Lead your YPP chapter from one place." />

      {showOnboardingBanner && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-brand-200 bg-brand-50 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold text-brand-900">Finish setting up as Chapter President</p>
            <p className="text-[12.5px] text-brand-700">{onboardingDone} of 4 setup steps complete.</p>
          </div>
          <ButtonLink href="/chapter/onboarding" variant="primary" size="sm">
            Continue onboarding
          </ButtonLink>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardV2 padding="lg" as="li" className="list-none">
          <h2 className="text-[15px] font-semibold text-ink">Onboarding</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Complete the setup steps for your chapter.</p>
          <ButtonLink href="/chapter/onboarding" variant="secondary" size="sm" className="mt-4">
            Go to Onboarding
          </ButtonLink>
        </CardV2>

        <CardV2 padding="lg" as="li" className="list-none">
          <h2 className="text-[15px] font-semibold text-ink">Chapter Goals & Resources</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Set chapter goals and review shared resources.</p>
          <ButtonLink href="/chapter/resources" variant="secondary" size="sm" className="mt-4">
            Go to Goals & Resources
          </ButtonLink>
        </CardV2>

        <CardV2 padding="lg" as="li" className="list-none">
          <h2 className="text-[15px] font-semibold text-ink">Recruiting</h2>
          <p className="mt-1 text-[13px] text-ink-muted">Review applications and manage open positions.</p>
          <ButtonLink href="/chapter/recruiting" variant="secondary" size="sm" className="mt-4">
            Go to Recruiting
          </ButtonLink>
        </CardV2>
      </div>
    </div>
  );
}