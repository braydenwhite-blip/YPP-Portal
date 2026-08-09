import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeaderV2, ButtonLink, CardV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  getOnboardingStatus,
  completeOnboardingStep,
  saveChapterGoals,
  saveIntroMessage,
} from "@/lib/chapter-president-onboarding-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Onboarding — Pathways Portal" };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  CHAPTER_PRESIDENT: "Chapter President",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
  PARENT: "Parent",
  APPLICANT: "Applicant",
};

const RESOURCES: { label: string; description: string; href: string }[] = [
  {
    label: "Recruiting",
    description: "How to bring on new instructors and students for your chapter.",
    href: "/chapter/recruiting",
  },
  {
    label: "Chapter Goals & Resources",
    description: "Set chapter goals and review shared resources.",
    href: "/chapter/resources",
  },
];

export default async function ChapterOnboardingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const onboarding = await getOnboardingStatus();

  if (!onboarding) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Onboarding"
          backHref="/chapter"
          backLabel="Chapter Home"
        />
        <CardV2 padding="lg" className="mt-8 text-center">
          <p className="text-[13px] text-ink-muted">
            No onboarding record was found for your account. Onboarding is created
            automatically when a chapter president application is approved. If you
            believe this is an error, contact{" "}
            <a href="mailto:support@youthpassionproject.org" className="text-brand-700 underline">
              support@youthpassionproject.org
            </a>
            .
          </p>
        </CardV2>
      </div>
    );
  }

  const roster = await prisma.user.findMany({
    where: { chapterId: onboarding.chapterId, id: { not: session.user.id } },
    select: { id: true, name: true, email: true, primaryRole: true },
    orderBy: { name: "asc" },
    take: 60,
  });

  const steps = [
    onboarding.metTeam,
    onboarding.setChapterGoals,
    onboarding.reviewedResources,
    onboarding.introMessageSent,
  ];
  const completedCount = steps.filter(Boolean).length;
  const allDone = completedCount === 4;
  const progressPercent = (completedCount / 4) * 100;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Onboarding"
          subtitle={
            onboarding.chapter?.name
              ? `Get set up to lead the ${onboarding.chapter.name} chapter.`
              : "Get set up to lead your chapter."
          }
          backHref="/chapter"
          backLabel="Chapter Home"
        />
        {allDone && (
          <ButtonLink href="/chapter" variant="primary" size="sm">
            Go to Chapter Home
          </ButtonLink>
        )}
      </div>

      <CardV2 padding="md" className="mt-6">
        <div className="flex items-center justify-between text-[13px] text-ink-muted">
          <span>Onboarding progress</span>
          <span>{completedCount} of 4 steps complete</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-brand-50">
          <div
            className={`h-2.5 rounded-full ${allDone ? "bg-green-600" : "bg-brand-600"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardV2>

      {allDone && (
        <CardV2 padding="md" className="mt-4 border border-green-200 bg-green-50">
          <p className="text-[14px] font-semibold text-green-800">
            Onboarding complete — you&apos;re ready to lead.
          </p>
          <p className="mt-1 text-[13px] text-green-700">
            Head to your Chapter Home to manage your chapter day to day.
          </p>
        </CardV2>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <StepCard
          index={1}
          title="Meet Your Team"
          description="Get to know the members already in your chapter and introduce yourself as the new chapter president."
          done={onboarding.metTeam}
        >
          {roster.length > 0 ? (
            <div className="mb-3 grid gap-1.5">
              {roster.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-[8px] bg-brand-50 px-3 py-1.5 text-[13px]"
                >
                  <span className="text-ink">{member.name || member.email}</span>
                  <span className="text-ink-muted">
                    {ROLE_LABELS[member.primaryRole] ?? member.primaryRole}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-ink-muted">
              No other members are in your chapter yet — recruiting them is one of
              your first jobs as president.
            </p>
          )}
          {!onboarding.metTeam && (
            <form action={completeOnboardingStep}>
              <input type="hidden" name="step" value="metTeam" />
              <button
                type="submit"
                className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                I&apos;ve connected with my team
              </button>
            </form>
          )}
        </StepCard>

        <StepCard
          index={2}
          title="Set Chapter Goals"
          description="Define what you want your chapter to achieve this term. These goals appear on your Chapter Home."
          done={onboarding.setChapterGoals}
        >
          <form action={saveChapterGoals}>
            <textarea
              name="chapterGoals"
              rows={4}
              required
              defaultValue={onboarding.chapterGoals ?? ""}
              placeholder="e.g. Recruit 3 instructors, run a passion-project showcase, grow to 25 active students…"
              className="mb-2 w-full rounded-[9px] border border-line px-3 py-2 text-[13px]"
            />
            <button
              type="submit"
              className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
            >
              {onboarding.setChapterGoals ? "Update goals" : "Save goals"}
            </button>
          </form>
        </StepCard>

        <StepCard
          index={3}
          title="Review Resources"
          description="Explore the tools you'll use to run your chapter."
          done={onboarding.reviewedResources}
        >
          <div className="mb-3 grid gap-2">
            {RESOURCES.map((resource) => (
              <Link
                key={resource.href}
                href={resource.href}
                className="block rounded-[9px] border border-line px-3 py-2.5 hover:bg-brand-50"
              >
                <div className="text-[14px] font-semibold text-ink">{resource.label}</div>
                <div className="text-[12px] text-ink-muted">{resource.description}</div>
              </Link>
            ))}
          </div>
          {!onboarding.reviewedResources && (
            <form action={completeOnboardingStep}>
              <input type="hidden" name="step" value="reviewedResources" />
              <button
                type="submit"
                className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
              >
                I&apos;ve reviewed these resources
              </button>
            </form>
          )}
        </StepCard>

        <StepCard
          index={4}
          title="Write Your Intro Message"
          description="Draft a welcome message to share with your chapter's members and parents. Save it here, then post it in your chapter channels."
          done={onboarding.introMessageSent}
        >
          <form action={saveIntroMessage}>
            <textarea
              name="introMessage"
              rows={5}
              required
              defaultValue={onboarding.introMessage ?? ""}
              placeholder="Hi everyone — I'm thrilled to be your new chapter president…"
              className="mb-2 w-full rounded-[9px] border border-line px-3 py-2 text-[13px]"
            />
            <button
              type="submit"
              className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
            >
              {onboarding.introMessageSent ? "Update intro message" : "Save intro message"}
            </button>
          </form>
        </StepCard>
      </div>
    </div>
  );
}

function StepCard({
  index,
  title,
  description,
  done,
  children,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <CardV2
      padding="md"
      className={done ? "border border-green-200 bg-green-50" : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
            done ? "bg-green-600 text-white" : "bg-brand-50 text-brand-700"
          }`}
        >
          {done ? "✓" : index}
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          <p className="mb-3 mt-0.5 text-[13px] text-ink-muted">{description}</p>
          {children}
        </div>
      </div>
    </CardV2>
  );
}