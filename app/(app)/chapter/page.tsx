import { redirect } from "next/navigation";

import { PageHeaderV2, EmptyStateV2, ButtonLink, CardV2 } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter — Pathways Portal" };

/** How CPs add people — the question Brayden asked in the team chat. */
const GROW_LINKS = [
  {
    href: "/partners",
    icon: "🏫",
    title: "Partners",
    body: "Add schools and organizations in the partner CRM — research, outreach, follow-ups, and confirmed partners.",
    cta: "Open Partners",
    primary: true,
  },
  {
    href: "/chapter/invites",
    icon: "🔗",
    title: "Students",
    body: "Share invite links so families can join. Review parent-led student journeys on the Student Intake board.",
    cta: "Create invite links",
    secondaryHref: "/chapter/student-intake",
    secondaryCta: "Student Intake",
    primary: false,
  },
  {
    href: "/chapter-lead/instructor-applicants",
    icon: "📝",
    title: "Instructors",
    body: "Review instructor applications on your chapter board — same hiring flow national uses, scoped to your chapter.",
    cta: "Open application board",
    primary: false,
  },
] as const;

const WORKSPACE_LINKS = [
  {
    href: "/chapter/hub",
    icon: "🗺",
    title: "My Chapter",
    body: "Members, calendar, invites, and chapter settings.",
    cta: "Open My Chapter",
  },
  {
    href: "/chapter/instructors",
    icon: "🎓",
    title: "Classes",
    body: "See instructors and open classroom dashboards.",
    cta: "Open Classes",
  },
  {
    href: "/chapter/impact",
    icon: "📊",
    title: "Analytics",
    body: "Track chapter impact and reporting for leadership.",
    cta: "Open Analytics",
  },
  {
    href: "/mentorship",
    icon: "🤝",
    title: "Mentorship",
    body: "Goals, reviews, and coaching for your chapter’s people.",
    cta: "Open Mentorship",
  },
] as const;

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
              <ButtonLink href="/chapter/apply" variant="primary" size="md">
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
  if (!chapter) redirect("/chapter/apply");

  const onboardingSteps = onboarding
    ? [onboarding.metTeam, onboarding.setChapterGoals, onboarding.reviewedResources, onboarding.introMessageSent]
    : [];
  const onboardingDone = onboardingSteps.filter(Boolean).length;
  const onboardingComplete =
    onboarding?.status === "COMPLETED" || (onboardingSteps.length > 0 && onboardingSteps.every(Boolean));
  const showOnboardingBanner = onboarding != null && !onboardingComplete;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeaderV2
        eyebrow="Chapter"
        title={chapter.name}
        subtitle="Lead your YPP chapter from one place."
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

      <section className="mt-8" aria-labelledby="grow-heading">
        <h2 id="grow-heading" className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          How you add people
        </h2>
        <p className="m-0 mt-1 max-w-2xl text-[13.5px] text-ink-muted">
          Instructors apply on the application board. Partners are added in the CRM. Students join via invite
          links or parent intake.
        </p>
        <ul className="mt-4 grid list-none grid-cols-1 gap-4 p-0 lg:grid-cols-3">
          {GROW_LINKS.map((link) => (
            <CardV2 key={link.href} padding="lg" as="li" className="list-none">
              <p className="m-0 text-[22px] leading-none" aria-hidden>
                {link.icon}
              </p>
              <h3 className="mt-3 text-[15px] font-semibold text-ink">{link.title}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{link.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink
                  href={link.href}
                  variant={link.primary ? "primary" : "secondary"}
                  size="sm"
                >
                  {link.cta}
                </ButtonLink>
                {"secondaryHref" in link && link.secondaryHref ? (
                  <ButtonLink href={link.secondaryHref} variant="ghost" size="sm">
                    {link.secondaryCta}
                  </ButtonLink>
                ) : null}
              </div>
            </CardV2>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="workspace-heading">
        <h2 id="workspace-heading" className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Your workspace
        </h2>
        <ul className="mt-4 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          {WORKSPACE_LINKS.map((link) => (
            <CardV2 key={link.href} padding="lg" as="li" className="list-none">
              <p className="m-0 text-[22px] leading-none" aria-hidden>
                {link.icon}
              </p>
              <h3 className="mt-3 text-[15px] font-semibold text-ink">{link.title}</h3>
              <p className="mt-1 text-[13px] text-ink-muted">{link.body}</p>
              <ButtonLink href={link.href} variant="secondary" size="sm" className="mt-4">
                {link.cta}
              </ButtonLink>
            </CardV2>
          ))}
        </ul>
      </section>
    </div>
  );
}
