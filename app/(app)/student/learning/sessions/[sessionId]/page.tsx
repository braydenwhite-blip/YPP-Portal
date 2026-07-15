import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentSessionSpace } from "@/lib/session8/student-portal";
import { submitAttendanceIssue } from "@/lib/session8/actions";
import { S8Page, S8Grid, S8Card, S8Item, S8List } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";
import { attendanceStatusLabel } from "@/lib/session8/labels";

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const u = await requireStudentPortalUser();
  const d: any = await getStudentSessionSpace(u.id, sessionId);
  if (!d) notFound();
  const s = d.session;

  return (
    <S8Page eyebrow="Session" title={s.topic} body={d.isPast ? "This session has already happened. Review your attendance status and ask YPP to check a record if something looks wrong." : "Authorized session details, preparation, and what to bring for enrolled students."} primaryHref={`/student/learning/classes/${s.offeringId}`} primaryLabel="Back to class">
      <S8Grid cols={2}>
        <S8Card title="When and where">
          <S8Item title={s.topic} meta={dateTime(s.date, s.startTime)} status={s.isCancelled ? "CANCELLED" : d.isPast ? "COMPLETED" : "SCHEDULED"}>
            {s.isCancelled ? s.cancelReason : d.location}
          </S8Item>
        </S8Card>

        {!d.isPast ? (
          <>
            <S8Card title="Preparation">
              <p>{s.description ?? "Come ready to participate and ask questions."}</p>
              <p>Materials: {s.materialsUrl ? "Available from instructor link" : "No special materials listed."}</p>
            </S8Card>
            {d.blockingForms?.length ? (
              <S8Card title="Before this session">
                <S8List items={d.blockingForms} empty="" render={(f: any) => <S8Item key={f.id} title={f.version?.template?.title ?? "Required form"} href="/student/forms">A form must be completed before attendance can be recorded for this class.</S8Item>} />
              </S8Card>
            ) : null}
          </>
        ) : (
          <>
            <S8Card title="Attendance">
              <S8Item title="Your record" status={d.attendance ? attendanceStatusLabel(d.attendance.status) : "Not recorded"}>
                {d.attendance ? "This is your recorded status for this session." : "Attendance has not been recorded for this session yet."}
              </S8Item>
              {d.openReviewRequest ? (
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Review requested — {d.openReviewRequest.externalStatus === "SENT" ? "sent, awaiting review" : d.openReviewRequest.externalStatus === "REVIEWING" ? "being reviewed" : "more information needed"}
                </p>
              ) : (
                <form action={submitAttendanceIssue} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="sessionId" value={s.id} />
                  <label className="sr-only" htmlFor="details">Explain attendance issue</label>
                  <input id="details" name="details" className="min-w-0 flex-1 rounded-full border px-3 py-2" placeholder="Ask YPP to review this record" />
                  <button className="rounded-full bg-slate-950 px-4 py-2 font-semibold text-white">Send review request</button>
                </form>
              )}
            </S8Card>
          </>
        )}

        <S8Card title="Support">
          <p className="mb-3 text-sm text-slate-600">Report an absence, technical issue, schedule issue, or discomfort. Internal notes and safety-sensitive handling remain restricted.</p>
          <Link href={`/student/support?category=${encodeURIComponent("I have a question about a class")}&offeringId=${s.offeringId}&sessionId=${s.id}`} className="rounded-full border px-4 py-2 text-sm font-semibold">Get support for this session</Link>
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
