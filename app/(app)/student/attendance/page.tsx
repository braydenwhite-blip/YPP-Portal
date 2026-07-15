import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentAttendance } from "@/lib/session8/student-portal";
import { submitAttendanceIssue } from "@/lib/session8/actions";
import { S8Page, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const rows = await getStudentAttendance(u.id);
  return (
    <S8Page
      eyebrow="Attendance"
      title="Your participation record"
      body="You can review attendance and ask YPP to check an issue. Students cannot directly change attendance records."
    >
      <S8Card title="Attendance by session">
        <S8List
          items={rows}
          empty="No attendance has been recorded yet."
          render={(r: any) => (
            <S8Item
              key={r.id}
              title={r.session?.offering?.title ?? "Class"}
              meta={dateTime(r.session?.date, r.session?.startTime) + " · " + (r.session?.topic ?? "")}
              status={r.status}
            >
              {r.reviewRequestStatus ? (
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Review requested — {r.reviewRequestStatus === "SENT" ? "sent, awaiting review" : r.reviewRequestStatus === "REVIEWING" ? "being reviewed" : "more information needed"}
                </p>
              ) : (
                <form action={submitAttendanceIssue} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="sessionId" value={r.sessionId} />
                  <label className="sr-only" htmlFor={"details-" + r.id}>
                    Explain attendance issue
                  </label>
                  <input
                    id={"details-" + r.id}
                    name="details"
                    className="min-w-0 flex-1 rounded-full border px-3 py-2"
                    placeholder="Ask YPP to review this record"
                  />
                  <button className="rounded-full bg-slate-950 px-4 py-2 font-semibold text-white">Send review request</button>
                </form>
              )}
            </S8Item>
          )}
        />
      </S8Card>
    </S8Page>
  );
}
