import Link from "next/link";

import { loadPersonChapterInvolvement } from "@/lib/chapters/person";
import { chapterLifecycleLabel, chapterLifecycleTone } from "@/lib/chapters/lifecycle";
import { cpStatusLabel } from "@/lib/chapter-president-lifecycle";
import { StatusBadge } from "@/components/ui-v2";

// Async server component — drop <PersonChapterSection userId={id} /> anywhere on a
// person profile. Renders nothing when the person has no chapter involvement.
export async function PersonChapterSection({ userId }: { userId: string }) {
  const data = await loadPersonChapterInvolvement(userId);
  if (!data) return null;

  const { ledChapters, memberChapter, application, metrics } = data;

  return (
    <section className="rounded-[14px] border border-line-card bg-surface p-5 shadow-card">
      <h2 className="mb-3 text-[15px] font-bold text-ink">Chapter involvement</h2>

      {ledChapters.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Chapter President of
          </p>
          {ledChapters.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/admin/chapters/${c.id}`} className="text-[14px] font-semibold text-brand-800 hover:underline">
                {c.name}
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-ink-muted">{c._count.users} members</span>
                <StatusBadge tone={chapterLifecycleTone(c.lifecycleStatus)}>
                  {chapterLifecycleLabel(c.lifecycleStatus)}
                </StatusBadge>
              </div>
            </div>
          ))}
        </div>
      )}

      {memberChapter && (
        <p className="mb-3 text-[13px] text-ink">
          <span className="text-ink-muted">Member of</span>{" "}
          <Link href={`/admin/chapters/${memberChapter.id}`} className="font-semibold text-brand-800 hover:underline">
            {memberChapter.name}
          </Link>{" "}
          <StatusBadge tone={chapterLifecycleTone(memberChapter.lifecycleStatus)}>
            {chapterLifecycleLabel(memberChapter.lifecycleStatus)}
          </StatusBadge>
        </p>
      )}

      {application && (
        <p className="mb-3 text-[13px] text-ink">
          <span className="text-ink-muted">CP application:</span>{" "}
          <Link
            href={`/admin/chapter-president-applicants/${application.id}`}
            className="font-semibold text-brand-800 hover:underline"
          >
            {cpStatusLabel(application.status)}
          </Link>{" "}
          <span className="text-[12px] text-ink-muted">
            · submitted {application.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-4 border-t border-line-soft pt-3 text-[12.5px] text-ink-muted">
        <span>
          <span className="font-semibold text-ink">{metrics.chapterActionsOwned}</span> chapter actions
        </span>
        <span>
          <span className="font-semibold text-ink">{metrics.chapterMeetingsLed}</span> meetings led
        </span>
        <span>
          <span className="font-semibold text-ink">{metrics.meetingsAttended}</span> meetings attended
        </span>
        {metrics.classesConnected > 0 && (
          <span>
            <span className="font-semibold text-ink">{metrics.classesConnected}</span> chapter classes
          </span>
        )}
        {metrics.supportRequestsInvolved > 0 && (
          <span>
            <span className="font-semibold text-ink">{metrics.supportRequestsInvolved}</span> open support requests
          </span>
        )}
      </div>
    </section>
  );
}
