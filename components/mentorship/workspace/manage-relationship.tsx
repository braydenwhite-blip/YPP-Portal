import { prisma } from "@/lib/prisma";
import { reassignProgramMentor } from "@/lib/mentorship-program-actions";

/**
 * Admin-only: reassign the mentor. Hidden from everyone else.
 * Server action also calls requireAdmin().
 */
export async function ManageRelationship({
  mentorshipId,
  menteeId,
  mentorId,
  status,
}: {
  mentorshipId: string;
  menteeId: string;
  mentorId: string;
  status: string;
}) {
  const eligibleMentors = await prisma.user.findMany({
    where: {
      OR: [
        { roles: { some: { role: "MENTOR" } } },
        { roles: { some: { role: "ADMIN" } } },
        { primaryRole: "INSTRUCTOR" },
        { primaryRole: "CHAPTER_PRESIDENT" },
      ],
      NOT: { id: { in: [menteeId, mentorId] } },
      archivedAt: null,
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand-500 focus:outline-none";
  const buttonCls =
    "inline-flex w-fit items-center justify-center rounded-lg border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-soft";

  return (
    <details className="rounded-xl border border-line-soft bg-surface-soft/50 px-4 py-3">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
        Admin
      </summary>

      <form action={reassignProgramMentor} className="mt-4 flex max-w-md flex-col gap-2">
        <input type="hidden" name="mentorshipId" value={mentorshipId} />
        <p className="m-0 text-[13px] font-semibold text-ink">Change mentor</p>
        <select name="newMentorId" required defaultValue="" className={inputCls}>
          <option value="" disabled>
            Pick someone…
          </option>
          {eligibleMentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name ?? m.email}
            </option>
          ))}
        </select>
        <input name="reason" className={inputCls} placeholder="Why?" />
        <button type="submit" className={buttonCls} disabled={status !== "ACTIVE"}>
          Save
        </button>
      </form>
    </details>
  );
}
