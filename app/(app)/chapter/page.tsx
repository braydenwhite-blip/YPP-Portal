import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { loadChapterWorkspace } from "@/lib/chapters/workspace";
import { loadChapterAttention } from "@/lib/chapters/attention";
import { ChapterWorkspaceView } from "@/components/chapters/chapter-workspace-view";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Home — Pathways Portal" };

// The single canonical Chapter President home. The former "Command Center",
// "Workspace", "President Dashboard", and "Chapter OS" surfaces all consolidate
// here so a CP has exactly one place to run their chapter — health, what needs
// them, launch, meetings, members, programs, and help, in one calm view.
export default async function ChapterHomePage() {
  const ctx = await getChapterViewerContext();

  // National leadership run every chapter from the command center, not a single
  // chapter home.
  if (!ctx.ledChapterId && ctx.isLeadership) {
    redirect("/admin/chapters");
  }

  if (!ctx.ledChapterId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Chapter Home"
          subtitle="Lead your YPP chapter from one place."
        />
        <div className="mt-8">
          <EmptyStateV2
            title="You don't lead a chapter yet"
            body="Once your Chapter President application is approved, your chapter home appears here — health, launch checklist, meetings, members, recruiting, and more."
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

  const data = await loadChapterWorkspace(ctx.ledChapterId);
  if (!data) {
    redirect("/chapter/apply");
  }

  const [attention, onboarding] = await Promise.all([
    loadChapterAttention(ctx.ledChapterId, { overdueActions: data.signals.overdueActions }),
    prisma.chapterPresidentOnboarding
      .findUnique({
        where: { userId: ctx.user.id },
        select: {
          status: true,
          metTeam: true,
          setChapterGoals: true,
          reviewedResources: true,
          introMessageSent: true,
        },
      })
      .catch(() => null),
  ]);

  // CP onboarding nudge — surfaced inline so the President has one home, never a
  // separate "President Dashboard" page.
  const onboardingSteps = onboarding
    ? [onboarding.metTeam, onboarding.setChapterGoals, onboarding.reviewedResources, onboarding.introMessageSent]
    : [];
  const onboardingDone = onboardingSteps.filter(Boolean).length;
  const onboardingComplete =
    onboarding?.status === "COMPLETED" || (onboardingSteps.length > 0 && onboardingSteps.every(Boolean));
  const showOnboardingBanner = onboarding != null && !onboardingComplete;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <PageHeaderV2
        eyebrow="Chapter President"
        title="Your Chapter Home"
        subtitle="Health, what needs you, launch, meetings, members, programs, and help — everything to run your chapter."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/chapter/recruiting" variant="secondary" size="sm">
              Recruiting
            </ButtonLink>
            <ButtonLink href="/chapter/settings" variant="secondary" size="sm">
              Settings
            </ButtonLink>
          </div>
        }
      />

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

      <div className="mt-6">
        <ChapterWorkspaceView data={data} attention={attention} canManage isLeadership={false} />
      </div>
    </div>
  );
}
