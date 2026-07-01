// Advisor caseload card — a calm, compact advising rollup for a person record.
//
// Server component; read-only. Renders the advisee caseload of a person who
// advises students (an instructor/mentor acting as an advisor), reusing the
// SAME lifecycle logic as the advising cockpit (summarizeAdvisorCaseload) so
// the record and the cockpit can never disagree. Self-hiding: when the person
// advises no one, it renders nothing rather than an empty shell — so it can be
// dropped onto any person page without making it heavier for non-advisors.

import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { summarizeAdvisorCaseload } from "@/lib/advising/relationship";

export async function AdvisorCaseloadCard({
  advisorId,
  now = new Date(),
}: {
  advisorId: string;
  now?: Date;
}) {
  if (!advisorId) return null;

  const assignments = await prisma.studentAdvisorAssignment
    .findMany({
      where: { advisorId, isActive: true },
      select: {
        advisingStatus: true,
        needsFollowUp: true,
        followUpNote: true,
        lastCheckInAt: true,
        nextCheckInDueAt: true,
        startDate: true,
      },
    })
    .catch(() => []);

  if (assignments.length === 0) return null;

  const roll = summarizeAdvisorCaseload(
    assignments.map((a) => ({ isActive: true, ...a })),
    now,
  );

  // Land on the lane that carries the most-urgent work, or the cockpit itself.
  const lane =
    roll.kickoffsNeeded > 0
      ? "kickoff_needed"
      : roll.followUpsDue > 0
        ? "follow_up_due"
        : null;
  const cockpitHref = lane ? `/operations/advising?lane=${lane}` : "/operations/advising";

  const stats: Array<{ label: string; value: number; danger?: boolean }> = [
    { label: "Advisees", value: roll.activeCount },
    { label: "Kickoffs needed", value: roll.kickoffsNeeded, danger: roll.kickoffsNeeded > 0 },
    { label: "Check-ins overdue", value: roll.followUpsDue, danger: roll.followUpsDue > 0 },
    { label: "On cadence", value: roll.onTrack },
  ];

  return (
    <section className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[15px] font-semibold text-[#1c1a2e]">Advising caseload</h2>
        <Link
          href={cockpitHref}
          className="text-[12.5px] font-medium text-brand-700 hover:underline"
        >
          Open advising queue →
        </Link>
      </div>
      <p className="m-0 mt-1 text-[13px] text-[#717189]">
        Students this person advises, graded by the same check-in cadence as the advising cockpit.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[10px] border border-[#ebebf2] bg-white px-3 py-2.5"
          >
            <div
              className={`text-[20px] font-bold leading-none tabular-nums ${
                s.danger && s.value > 0 ? "text-danger-700" : "text-[#1c1a2e]"
              }`}
            >
              {s.value}
            </div>
            <div className="mt-1 text-[11.5px] font-medium text-[#717189]">{s.label}</div>
          </div>
        ))}
      </div>

      {roll.nextAction ? (
        <p className="m-0 mt-3 rounded-[8px] bg-white px-3 py-2 text-[12.5px] text-[#1c1a2e]">
          <span className="font-semibold">Next: </span>
          {roll.nextAction}
        </p>
      ) : null}
    </section>
  );
}
