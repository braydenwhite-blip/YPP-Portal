import { PageHeaderV2, CardV2, EmptyStateV2 } from "@/components/ui-v2";
import { getInstructorAvailability } from "@/lib/session8/instructor-development";
import { AvailabilityDayForm } from "./availability-day-form";

export default async function InstructorAvailabilityPage() {
  const { week, conflicts } = await getInstructorAvailability();
  const hasAnyRow = week.some((w) => w.row);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Instructor development"
        title="My availability"
        subtitle="Set the days and times you're available to teach. Changes here do not automatically reassign or move any class you're already teaching."
      />

      {conflicts.length > 0 ? (
        <CardV2 className="border-blocked-200 bg-blocked-50/40">
          <h2 className="text-sm font-semibold text-blocked-700">Conflicts with your current classes</h2>
          <ul className="mt-2 space-y-1 text-sm text-blocked-700">
            {conflicts.map((c, i) => (
              <li key={`${c.offeringId}-${i}`}>
                You marked yourself unavailable this day, but <span className="font-semibold">{c.offeringTitle}</span>{" "}
                meets at {c.meetingTime} on this weekday.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-blocked-700/80">
            This doesn't remove or reassign the class — reach out to your chapter to resolve the conflict.
          </p>
        </CardV2>
      ) : null}

      {!hasAnyRow ? (
        <EmptyStateV2
          title="No availability set yet"
          body="Save at least one day below so chapters and admins know when you can teach."
        />
      ) : null}

      <div className="space-y-3">
        {week.map(({ weekday, label, row }) => (
          <CardV2 key={weekday} padding="md">
            <AvailabilityDayForm weekday={weekday} label={label} row={row} />
          </CardV2>
        ))}
      </div>
    </main>
  );
}
