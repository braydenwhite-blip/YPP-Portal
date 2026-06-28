import { CardV2, StatusBadge, EmptyStateV2, type StatusTone } from "@/components/ui-v2";
import { getPublicCatalog } from "@/lib/classes/public-catalog-loader";
import type { SignupAvailability } from "@/lib/classes/public-catalog";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Find a Class — Youth Passion Project",
  description: "Discover Youth Passion Project classes near you and sign your student up.",
};

const AVAIL_TONE: Record<SignupAvailability, StatusTone> = { open: "success", waitlist: "warning", closed: "neutral" };
const AVAIL_LABEL: Record<SignupAvailability, string> = { open: "Enrolling", waitlist: "Waitlist", closed: "Closed" };

// Public, shareable class catalog — the family's front door. Only classes that
// are genuinely safe to advertise appear (approved, scheduled, described).
export default async function PublicCatalogPage() {
  const classes = await getPublicCatalog();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.08em] text-brand-700">Youth Passion Project</p>
        <h1 className="m-0 mt-1 text-[26px] font-bold text-ink">Find a class</h1>
        <p className="m-0 mt-1 max-w-2xl text-[14px] text-ink-muted">
          Free, project-based classes taught by passionate young instructors. Browse what&rsquo;s enrolling now and sign
          your student up in a couple of minutes.
        </p>
      </header>

      {classes.length === 0 ? (
        <div className="mt-8">
          <EmptyStateV2
            title="No classes are open right now"
            body="New classes open throughout the year. Check back soon, or ask your local chapter what's coming up."
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <CardV2 key={c.id} padding="none" className="overflow-hidden">
              <a href={`/classes/${c.id}`} className="block px-5 py-4 transition-colors hover:bg-surface-soft">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="m-0 text-[16px] font-bold text-ink">{c.title}</h2>
                  <StatusBadge tone={AVAIL_TONE[c.availability]}>{AVAIL_LABEL[c.availability]}</StatusBadge>
                </div>
                {c.shortDescription && <p className="m-0 mt-1.5 text-[13px] text-ink-muted">{c.shortDescription}</p>}
                <dl className="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12.5px]">
                  <Fact label="When" value={c.scheduleLabel} />
                  <Fact label="Where" value={c.locationLabel} />
                  <Fact label="Starts" value={c.startDateLabel} />
                  <Fact label="Ages" value={c.ageRange ? c.ageRange.replace(/-/g, "–") : "All welcome"} />
                </dl>
                <div className="mt-3 flex items-center justify-between border-t border-line-card pt-2.5">
                  <span className="text-[12px] text-ink-muted">
                    {c.sessionsCount > 0 ? `${c.sessionsCount} sessions` : "Schedule posting soon"}
                    {c.chapterName ? ` · ${c.chapterName}` : ""}
                  </span>
                  <span className="text-[12.5px] font-semibold text-brand-700">View &amp; sign up →</span>
                </div>
              </a>
            </CardV2>
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
      <dd className="m-0 font-medium text-ink">{value}</dd>
    </div>
  );
}
