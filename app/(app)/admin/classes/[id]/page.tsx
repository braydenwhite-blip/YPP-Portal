import { getOfferingTimeline } from "@/lib/class-offering-timeline";
import { RecordSection } from "@/components/ui-v2";
import { ClassPublishControls } from "./_components/publish-controls";
import { ClassReviewBanner } from "./_components/header";
import { loadClassAdminDetail } from "./_components/loaders";

export const dynamic = "force-dynamic";

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export default async function AdminClassOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, timeline] = await Promise.all([
    loadClassAdminDetail(id),
    getOfferingTimeline(id, 8),
  ]);

  const scheduleLine = [
    detail.meetingDays.join(", ") || null,
    detail.meetingTime || null,
    detail.timezone,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <ClassReviewBanner detail={detail} />
      <ClassPublishControls detail={detail} />

      <RecordSection title="Schedule" description="When and where this class meets.">
        <dl className="m-0 grid gap-3 sm:grid-cols-2">
          <Fact label="Starts" value={detail.startDate.toLocaleDateString(undefined, DATE_FMT)} />
          <Fact label="Ends" value={detail.endDate.toLocaleDateString(undefined, DATE_FMT)} />
          <Fact label="When" value={scheduleLine || "—"} />
          <Fact
            label="Location"
            value={
              detail.deliveryMode === "IN_PERSON"
                ? [detail.locationName, detail.locationAddress].filter(Boolean).join(", ") || "Not set"
                : detail.zoomLink
                  ? "Online · link on file"
                  : detail.deliveryMode.replace("_", " ")
            }
            warn={
              (detail.deliveryMode === "IN_PERSON" && !detail.locationName) ||
              ((detail.deliveryMode === "VIRTUAL" || detail.deliveryMode === "HYBRID") &&
                !detail.zoomLink)
            }
          />
        </dl>
        <p className="mb-0 mt-4 text-[12.5px] text-ink-muted">
          Update room, arrival notes, and materials in{" "}
          <a href={`/admin/classes/${detail.id}/settings`} className="font-semibold text-brand-700">
            Settings
          </a>
          .
        </p>
      </RecordSection>

      <RecordSection
        title="Recent activity"
        description="Latest admin actions on this class."
      >
        {timeline.length === 0 ? (
          <p className="m-0 text-[13px] text-ink-muted">No activity recorded yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-0 p-0">
            {timeline.map((event) => (
              <li
                key={event.id}
                className="flex gap-3 border-b border-line-soft py-3 last:border-0 last:pb-0 first:pt-0"
              >
                <span
                  aria-hidden
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-400"
                />
                <div className="min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-ink">
                    {event.kind.replace(/_/g, " ")}
                  </p>
                  {event.summary ? (
                    <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{event.summary}</p>
                  ) : null}
                  <p className="m-0 mt-1 text-[12px] text-ink-muted">
                    {event.createdAt.toLocaleDateString(undefined, DATE_FMT)} ·{" "}
                    {event.actor?.name ?? "System"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </div>
  );
}

function Fact({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </dt>
      <dd
        className={`m-0 mt-0.5 text-[14px] font-semibold ${warn ? "text-danger-700" : "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}
