import { AskAboutThis } from "@/components/help-agent/ask-about-this";
import { EntityWorkflowCard } from "@/components/workflow-engine/entity-workflow-card";
import { prisma } from "@/lib/prisma";
import {
  reassignProgramMentor,
  setProgramMentorshipStatus,
} from "@/lib/mentorship-program-actions";

/**
 * Leadership-only relationship controls, folded in from the old
 * /admin/mentorship/relationships/[mentorshipId] page. Deliberately
 * restrained: reassign the mentor, pause/resume/close the relationship, and
 * (if one is running) the mentorship workflow status — behind one
 * disclosure, not an embedded dashboard.
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
  const labelCls = "text-[12px] font-semibold text-ink-muted";
  const buttonCls =
    "inline-flex w-fit items-center justify-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-surface-soft";

  return (
    <details className="rounded-[12px] border border-line-soft bg-surface-soft/60 p-4">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted">
        Manage relationship
      </summary>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <form action={reassignProgramMentor} className="flex flex-col gap-2.5">
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <p className="m-0 text-[13px] font-bold text-ink">Reassign mentor</p>
          <label className="grid gap-1">
            <span className={labelCls}>New mentor</span>
            <select name="newMentorId" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Select…
              </option>
              {eligibleMentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className={labelCls}>Reason (optional)</span>
            <input name="reason" className={inputCls} placeholder="Recorded in the audit log" />
          </label>
          <button type="submit" className={buttonCls} disabled={status !== "ACTIVE"}>
            Reassign
          </button>
        </form>

        <form action={setProgramMentorshipStatus} className="flex flex-col gap-2.5">
          <input type="hidden" name="mentorshipId" value={mentorshipId} />
          <p className="m-0 text-[13px] font-bold text-ink">Relationship status</p>
          <label className="grid gap-1">
            <span className={labelCls}>Set status</span>
            <select name="status" defaultValue={status} className={inputCls}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETE">Complete</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className={labelCls}>Reason (optional)</span>
            <input name="reason" className={inputCls} placeholder="Recorded in the audit log" />
          </label>
          <button type="submit" className={buttonCls}>
            Update status
          </button>
        </form>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex justify-end">
          <AskAboutThis entityType="mentorship" entityId={mentorshipId} align="right" />
        </div>
        <EntityWorkflowCard
          entityType="MENTORSHIP"
          entityId={mentorshipId}
          title="Mentorship workflow"
        />
      </div>
    </details>
  );
}
