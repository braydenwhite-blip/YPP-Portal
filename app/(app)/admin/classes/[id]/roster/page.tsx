import { notFound, redirect } from "next/navigation";import { getSession } from "@/lib/auth-supabase";
import {
  getAdminClassRoster,
  adminPromoteFromWaitlist,
  adminUpdateEnrollmentStatus,
} from "@/lib/admin-class-operations";
import {
  ActionButtonGroup,
  BannerV2,
  Button,
  buttonVariants,
  RecordSection,
  StatusBadge,
} from "@/components/ui-v2";
import { cn } from "@/components/ui-v2/cn";

export const dynamic = "force-dynamic";

type RosterEntry = NonNullable<
  Awaited<ReturnType<typeof getAdminClassRoster>>
>["enrollments"][number];

export default async function AdminClassRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const { id } = await params;
  const data = await getAdminClassRoster(id);
  if (!data) notFound();

  const { offering, enrollments, groups } = data;
  const overCapacity = groups.confirmed.length > offering.capacity;
  const seenStudentIds = new Map<string, number>();
  for (const entry of enrollments) {
    seenStudentIds.set(
      entry.student.id,
      (seenStudentIds.get(entry.student.id) ?? 0) + 1,
    );
  }
  const duplicates = new Set(
    [...seenStudentIds.entries()]
      .filter(([, count]) => count > 1)
      .map(([studentId]) => studentId),
  );

  return (
    <div className="flex flex-col gap-5">
      {overCapacity ? (
        <BannerV2 tone="danger" title="Roster exceeds capacity">
          {groups.confirmed.length} confirmed against capacity {offering.capacity}. Move
          someone to the waitlist or raise capacity in Settings.
        </BannerV2>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[13px] text-ink-muted">
          {groups.confirmed.length}/{offering.capacity} confirmed ·{" "}
          {groups.waitlisted.length} waitlisted ·{" "}
          {offering.enrollmentOpen ? "Enrollment open" : "Enrollment closed"}
        </p>
        <ActionButtonGroup>
          <a
            href={`/api/admin/classes/${offering.id}/roster/export`}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Export CSV
          </a>
          <form action={adminPromoteFromWaitlist}>
            <input type="hidden" name="offeringId" value={offering.id} />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={
                groups.waitlisted.length === 0 ||
                groups.confirmed.length >= offering.capacity
              }
            >
              Promote from waitlist
            </Button>
          </form>
        </ActionButtonGroup>
      </div>

      <RosterSection
        title={`Confirmed (${groups.confirmed.length})`}
        emptyText="No confirmed students yet."
        rows={groups.confirmed}
        duplicates={duplicates}
        actions={["WAITLIST", "DROP", "COMPLETE"]}
      />
      <RosterSection
        title={`Waitlisted (${groups.waitlisted.length})`}
        emptyText="No one on the waitlist."
        rows={groups.waitlisted}
        duplicates={duplicates}
        actions={["ENROLL", "DROP"]}
      />
      <RosterSection
        title={`Dropped (${groups.dropped.length})`}
        emptyText="No drops."
        rows={groups.dropped}
        duplicates={duplicates}
        actions={["ENROLL"]}
        muted
      />
      <RosterSection
        title={`Completed (${groups.completed.length})`}
        emptyText="No completions yet."
        rows={groups.completed}
        duplicates={duplicates}
        actions={[]}
        muted
      />
    </div>
  );
}

function RosterSection({
  title,
  emptyText,
  rows,
  duplicates,
  actions,
  muted = false,
}: {
  title: string;
  emptyText: string;
  rows: RosterEntry[];
  duplicates: Set<string>;
  actions: ("ENROLL" | "WAITLIST" | "DROP" | "COMPLETE")[];
  muted?: boolean;
}) {
  return (
    <RecordSection title={title} className={muted ? "opacity-85" : undefined}>
      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">{emptyText}</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-soft text-left">
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Student
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Grade
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Contact
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Signed up
                </th>
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <RosterRow
                  key={entry.id}
                  entry={entry}
                  isDuplicate={duplicates.has(entry.student.id)}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RecordSection>
  );
}

function RosterRow({
  entry,
  isDuplicate,
  actions,
}: {
  entry: RosterEntry;
  isDuplicate: boolean;
  actions: ("ENROLL" | "WAITLIST" | "DROP" | "COMPLETE")[];
}) {
  const parents = entry.student.studentLinks ?? [];
  const primaryParent = parents[0]?.parent;
  const grade =
    entry.student.profile?.grade != null
      ? String(entry.student.profile.grade)
      : "—";
  const parentEmail =
    primaryParent?.email ?? entry.student.profile?.parentEmail ?? "—";

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-3 py-3 align-top">
        <div className="font-semibold text-ink">
          {entry.student.name}
          {isDuplicate ? (
            <StatusBadge tone="danger" className="ml-2">
              Duplicate
            </StatusBadge>
          ) : null}
        </div>
        {entry.waitlistPosition != null ? (
          <p className="m-0 mt-0.5 text-[11px] text-ink-muted">
            #{entry.waitlistPosition} on waitlist
          </p>
        ) : null}
        {entry.signupGoal || entry.signupNote ? (
          <p className="m-0 mt-1 max-w-xs text-[11px] text-ink-muted">
            {entry.signupGoal ? entry.signupGoal : null}
            {entry.signupNote ? ` · “${entry.signupNote}”` : null}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top text-ink-muted">{grade}</td>
      <td className="px-3 py-3 align-top">
        <p className="m-0 text-ink">{entry.student.email}</p>
        {primaryParent ? (
          <p className="m-0 mt-1 text-[12px] text-ink-muted">
            {primaryParent.name} · {parentEmail}
          </p>
        ) : entry.student.profile?.parentEmail ? (
          <p className="m-0 mt-1 text-[12px] text-ink-muted">
            {entry.student.profile.parentEmail}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-3 align-top text-ink-muted">
        {entry.enrolledAt.toLocaleDateString()}
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          {actions.includes("ENROLL") ? (
            <ActionForm enrollmentId={entry.id} status="ENROLLED" label="Confirm" />
          ) : null}
          {actions.includes("WAITLIST") ? (
            <ActionForm enrollmentId={entry.id} status="WAITLISTED" label="Waitlist" />
          ) : null}
          {actions.includes("COMPLETE") ? (
            <ActionForm enrollmentId={entry.id} status="COMPLETED" label="Complete" />
          ) : null}
          {actions.includes("DROP") ? (
            <ActionForm enrollmentId={entry.id} status="DROPPED" label="Drop" danger />
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ActionForm({
  enrollmentId,
  status,
  label,
  danger = false,
}: {
  enrollmentId: string;
  status: "ENROLLED" | "WAITLISTED" | "DROPPED" | "COMPLETED";
  label: string;
  danger?: boolean;
}) {
  return (
    <form action={adminUpdateEnrollmentStatus}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={danger ? "danger" : "ghost"} size="sm">
        {label}
      </Button>
    </form>
  );
}
