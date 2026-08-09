import { redirect } from "next/navigation";

import { PageHeaderV2, ButtonLink, CardV2, EmptyStateV2 } from "@/components/ui-v2";
import { getChapterViewerContext } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";
import { createChapterGoal } from "@/lib/chapter-goal-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chapter Goals & Resources — Pathways Portal" };

export default async function ChapterGoalsResourcesPage() {
  const ctx = await getChapterViewerContext();
  if (!ctx.ledChapterId) redirect("/chapter");

  const chapterId = ctx.ledChapterId;

  const [goals, resources] = await Promise.all([
    prisma.chapterGoal.findMany({
      where: { chapterId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.resource.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <PageHeaderV2
        eyebrow="Chapter"
        title="Chapter Goals & Resources"
        subtitle="Set goals for your chapter and review shared resources."
        backHref="/chapter"
        backLabel="Chapter Home"
      />

      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-ink">Goals</h2>

        {goals.length === 0 ? (
          <div className="mt-3">
            <EmptyStateV2 title="No active goals yet" body="Add a goal below to start tracking progress." />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
              return (
                <CardV2 key={goal.id} padding="md">
                  <p className="text-[14px] font-semibold text-ink">{goal.title}</p>
                  {goal.description ? (
                    <p className="mt-1 text-[12.5px] text-ink-muted">{goal.description}</p>
                  ) : null}
                  <p className="mt-2 text-[12.5px] text-ink-muted">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </p>
                  <div className="mt-1 h-2 w-full rounded-full bg-brand-50">
                    <div
                      className="h-2 rounded-full bg-brand-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {goal.deadline ? (
                    <p className="mt-2 text-[12px] text-ink-muted">
                      Due {new Date(goal.deadline).toLocaleDateString()}
                    </p>
                  ) : null}
                </CardV2>
              );
            })}
          </div>
        )}

        <CardV2 padding="md" className="mt-4">
          <p className="text-[13px] font-semibold text-ink">Add a goal</p>
          <form action={createChapterGoal} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              name="title"
              placeholder="Goal title"
              required
              className="rounded-[9px] border border-line px-3 py-2 text-[13px] sm:col-span-2"
            />
            <input
              name="targetValue"
              type="number"
              min="1"
              placeholder="Target"
              required
              className="rounded-[9px] border border-line px-3 py-2 text-[13px]"
            />
            <input
              name="unit"
              placeholder="Unit (e.g. members)"
              required
              className="rounded-[9px] border border-line px-3 py-2 text-[13px]"
            />
            <input
              name="deadline"
              type="date"
              className="rounded-[9px] border border-line px-3 py-2 text-[13px] sm:col-span-2"
            />
            <button
              type="submit"
              className="rounded-[9px] border border-transparent bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_52%,#8b3fe8_100%)] px-4 py-2 text-[13px] font-semibold text-white sm:col-span-2"
            >
              Add goal
            </button>
          </form>
        </CardV2>
      </section>

      <section className="mt-10">
        <h2 className="text-[16px] font-semibold text-ink">Resources</h2>

        {resources.length === 0 ? (
          <div className="mt-3">
            <EmptyStateV2 title="No resources available yet" body="Shared resources will appear here." />
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resources.map((resource) => (
              <CardV2 key={resource.id} padding="md">
                <p className="text-[14px] font-semibold text-ink">{resource.title}</p>
                {resource.description ? (
                  <p className="mt-1 text-[12.5px] text-ink-muted">{resource.description}</p>
                ) : null}
                {resource.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {resource.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[6px] bg-brand-50 px-2 py-0.5 text-[11px] text-ink-muted"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <ButtonLink href={resource.url} variant="secondary" size="sm" className="mt-3">
                  Open Resource
                </ButtonLink>
              </CardV2>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}