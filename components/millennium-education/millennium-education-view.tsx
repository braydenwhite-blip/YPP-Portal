import {
  PageHeaderV2,
  CardV2,
  Button,
  StatusBadge,
  EmptyStateV2,
} from "@/components/ui-v2";
import { DataTableShell, TableV2 } from "@/components/ui-v2/data-table-shell";
import {
  createMillenniumEducationRecord,
  updateMillenniumEducationRecord,
} from "@/lib/millennium-education-actions";

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = {
  ENROLLED: "info",
  IN_PROGRESS: "neutral",
  COMPLETED: "success",
  WITHDRAWN: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  ENROLLED: "Enrolled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  WITHDRAWN: "Withdrawn",
};

type RecordRow = {
  id: string;
  status: string;
  startDate: Date | null;
  completionDate: Date | null;
  hoursCompleted: number;
  certificateIssued: boolean;
  notes: string | null;
  student: { id: string; name: string; email: string; chapter: { name: string } | null };
};

type UntrackedStudent = { id: string; name: string; chapter: { name: string } | null };

export function MillenniumEducationView({
  eyebrow,
  records,
  untrackedStudents,
}: {
  eyebrow: string;
  records: RecordRow[];
  untrackedStudents: UntrackedStudent[];
}) {
  return (
    <div className="space-y-6">
      <PageHeaderV2
        eyebrow={eyebrow}
        title="Millennium Education tracking"
        subtitle="Every student enrolled in the Millennium Education partnership, across all chapters."
      />

      <CardV2 padding="lg">
        <h2 className="text-[15px] font-semibold text-ink">Add a student</h2>
        <form action={createMillenniumEducationRecord} className="mt-3 grid gap-3 md:grid-cols-5">
          <select name="studentId" required className="rounded-[var(--radius-control)] border border-line p-2 text-sm md:col-span-2">
            <option value="">Select student</option>
            {untrackedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.chapter ? ` — ${s.chapter.name}` : ""}
              </option>
            ))}
          </select>
          <select name="status" defaultValue="ENROLLED" className="rounded-[var(--radius-control)] border border-line p-2 text-sm">
            <option value="ENROLLED">Enrolled</option>
            <option value="IN_PROGRESS">In progress</option>
          </select>
          <input type="date" name="startDate" className="rounded-[var(--radius-control)] border border-line p-2 text-sm" />
          <Button type="submit" variant="primary" size="md">Add</Button>
        </form>
      </CardV2>

      {records.length === 0 ? (
        <EmptyStateV2
          title="No students tracked yet"
          body="Add a student above to start tracking their Millennium Education progress."
        />
      ) : (
        <DataTableShell
          header={
            <>
              <h2 className="text-[15px] font-semibold text-ink">All records</h2>
              <span className="text-[12.5px] text-ink-muted">{records.length} total</span>
            </>
          }
        >
          <TableV2>
            <thead>
              <tr className="border-b border-line-soft text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Chapter</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Certificate</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3">Update</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{r.student.name}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.student.chapter?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{r.hoursCompleted}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.certificateIssued ? "Issued" : "Not yet"}</td>
                  <td className="px-5 py-3 max-w-[200px] truncate text-ink-muted">{r.notes ?? "—"}</td>
                  <td className="px-5 py-3">
                    <details>
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-brand-700">Edit</summary>
                      <form action={updateMillenniumEducationRecord} className="mt-2 grid gap-2 text-[12.5px]">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} className="rounded-[var(--radius-control)] border border-line p-1.5">
                          <option value="ENROLLED">Enrolled</option>
                          <option value="IN_PROGRESS">In progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="WITHDRAWN">Withdrawn</option>
                        </select>
                        <input type="number" name="hoursCompleted" defaultValue={r.hoursCompleted} className="rounded-[var(--radius-control)] border border-line p-1.5" />
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" name="certificateIssued" defaultChecked={r.certificateIssued} />
                          Certificate issued
                        </label>
                        <input type="date" name="completionDate" className="rounded-[var(--radius-control)] border border-line p-1.5" />
                        <textarea name="notes" defaultValue={r.notes ?? ""} className="min-h-16 rounded-[var(--radius-control)] border border-line p-1.5" />
                        <Button type="submit" variant="secondary" size="sm">Save</Button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableV2>
        </DataTableShell>
      )}
    </div>
  );
}