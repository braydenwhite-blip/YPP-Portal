import { notFound } from "next/navigation";
import { getInstructorSession } from "@/lib/session8/instructor-ops";
import { confirmSessionReady } from "@/lib/session8/actions";
import { createInstructorFollowUp } from "@/lib/session8/instructor-actions";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";
import { SessionAttendancePanel } from "@/components/operations/attendance-roster";

export default async function Page({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const { id, sessionId } = await params;
  const s: any = await getInstructorSession(id, sessionId);
  if (!s) notFound();
  const prep = (s.preparations ?? [])[0];
  const isPast = s.isPastOrToday;

  const students = s.offering.enrollments
    .filter((e: any) => s.activeStudentIds.includes(e.studentId))
    .map((e: any) => ({ id: e.studentId, name: e.student?.name ?? null, email: e.student?.email ?? null }));
  const existingRecords = s.attendance.map((a: any) => ({ studentId: a.studentId, status: a.status, notes: a.notes, finalizedAt: a.finalizedAt, updatedAt: a.updatedAt }));

  return (
    <S8Page
      eyebrow="Session command center"
      title={s.topic}
      body="Prepare, teach, record attendance, send updates, and create structured follow-up actions."
      primaryHref={`/instructor/classes/${id}`}
      primaryLabel="Back to class"
    >
      <S8Grid cols={2}>
        <S8Card title="Session logistics">
          <p>{dateTime(s.date, s.startTime)}–{s.endTime}</p>
          <p>{s.offering.deliveryMode} · {s.offering.locationName ?? "Location/link pending"}</p>
          <p>{s.description}</p>
          <p className="mt-2 text-sm text-slate-500">Roster: {s.rosterCount} active student(s)</p>
        </S8Card>

        {!isPast && (
          <>
            <S8Card title="Readiness">
              {prep?.completedAt && (
                <p className="mb-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-sm text-emerald-900">Readiness confirmed.</p>
              )}
              <form action={confirmSessionReady} className="space-y-3">
                <input type="hidden" name="sessionId" value={s.id} />
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="lessonReviewed" defaultChecked={!!prep?.lessonReviewedAt} className="h-5 w-5" /> Lesson reviewed{prep?.lessonReviewedAt ? " (done)" : ""}
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="materialsReviewed" defaultChecked={!!prep?.materialsReviewedAt} className="h-5 w-5" /> Materials reviewed{prep?.materialsReviewedAt ? " (done)" : ""}
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="studentContextReviewed" defaultChecked={!!prep?.studentContextReviewedAt} className="h-5 w-5" /> Student context reviewed{prep?.studentContextReviewedAt ? " (done)" : ""}
                </label>
                <label className="block text-sm font-semibold" htmlFor="note">Readiness note</label>
                <textarea id="note" name="note" defaultValue={prep?.note ?? ""} className="w-full rounded-2xl border p-3" placeholder="Materials reviewed, student context checked, logistics confirmed" />
                <button className="min-h-11 rounded-full bg-violet-700 px-4 py-2 font-semibold text-white">Save readiness</button>
              </form>
            </S8Card>

            <S8Card title="Roster & Blockers">
              <S8List
                items={s.offering.enrollments.filter((e: any) => s.activeStudentIds.includes(e.studentId))}
                empty="No roster."
                render={(e: any) => (
                  <S8Item key={e.id} title={e.student?.name ?? "Student"} meta={e.student?.profile?.preferredName ?? ""} status={s.blockerStudentIds.includes(e.studentId) ? "FORM BLOCKER" : "READY"} />
                )}
              />
              {s.openReviewRequests.length > 0 && (
                <p className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm text-amber-900">
                  {s.openReviewRequests.length} open attendance review request(s) for this session.
                </p>
              )}
            </S8Card>
          </>
        )}

        {isPast && (
          <>
            <S8Card title="Attendance">
              <SessionAttendancePanel
                classId={id}
                students={students}
                sessions={[{ id: s.id, label: s.topic, isCancelled: s.isCancelled, attendance: existingRecords, complete: s.isFinalized }]}
                canOverrideFinalized={false}
              />
            </S8Card>

            <S8Card title="After the Session">
              {s.openReviewRequests.length > 0 && (
                <p className="mb-2 rounded-xl bg-amber-50 border border-amber-200 p-2 text-sm text-amber-900">
                  {s.openReviewRequests.length} open attendance review request(s) for this session — respond from the class page.
                </p>
              )}
              <a href={`/instructor/classes/${id}`} className="block text-sm font-semibold text-violet-700 underline">
                Write student feedback on the class page
              </a>
              {s.offering.sessions.find((os: any) => new Date(os.date) > new Date(s.date) && !os.isCancelled) && (
                <a
                  href={`/instructor/classes/${id}/sessions/${s.offering.sessions.filter((os: any) => new Date(os.date) > new Date(s.date) && !os.isCancelled).sort((a: any, b: any) => +new Date(a.date) - +new Date(b.date))[0].id}`}
                  className="mt-2 block text-sm font-semibold text-violet-700 underline"
                >
                  Go prep the next session
                </a>
              )}
            </S8Card>
          </>
        )}

        <S8Card title="Follow-up actions">
          <p className="mb-2 text-sm text-slate-600">Create a structured follow-up item for location issues, participation concerns, family-facing notes, or anything else that needs attention.</p>
          <form action={createInstructorFollowUp} className="space-y-2">
            <input type="hidden" name="sessionId" value={s.id} />
            <label className="block text-sm font-semibold" htmlFor="fu-title">Title</label>
            <input id="fu-title" name="title" required maxLength={200} className="w-full rounded-xl border p-3 text-sm" />
            <label className="block text-sm font-semibold" htmlFor="fu-description">Details (optional)</label>
            <textarea id="fu-description" name="description" className="w-full rounded-xl border p-3 text-sm" />
            <label className="block text-sm font-semibold" htmlFor="fu-priority">Priority</label>
            <select id="fu-priority" name="priority" defaultValue="MEDIUM" className="w-full rounded-xl border p-3 text-sm">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <button className="min-h-11 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Create follow-up</button>
          </form>
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
