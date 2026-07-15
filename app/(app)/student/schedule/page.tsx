import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentSchedule, getStudentAttendance } from "@/lib/session8/student-portal";
import { S8Page, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";
import { attendanceStatusLabel } from "@/lib/session8/labels";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7; // Monday-start
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default async function Page() {
  const u = await requireStudentPortalUser();
  const [items, attendance] = await Promise.all([getStudentSchedule(u.id), getStudentAttendance(u.id)]);
  const recentPast = attendance.slice(0, 5);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const next = items[0] ? [items[0]] : [];
  const thisWeek = items.slice(1).filter((i: any) => new Date(i.date) < weekEnd);
  const later = items.slice(1).filter((i: any) => new Date(i.date) >= weekEnd);

  const render = (i: any) => (
    <S8Item key={i.session?.id ?? i.title} title={i.title} meta={dateTime(i.date, i.time) + " · " + (i.location ?? "Details pending")} status={i.status} href={i.href ?? undefined}>
      {i.kind}{i.status === "CANCELLED" ? " · Cancelled" : ""}
    </S8Item>
  );

  return (
    <S8Page eyebrow="Student schedule" title="Everything coming up" body="Grouped by when it's happening. Location details only appear when you are authorized to receive them." primaryHref="/student/learning" primaryLabel="My learning">
      <S8Card title="Next">
        <S8List items={next} empty="Nothing scheduled yet." render={render} />
      </S8Card>
      <S8Card title="This week">
        <S8List items={thisWeek} empty="Nothing else this week." render={render} />
      </S8Card>
      <S8Card title="Later">
        <S8List items={later} empty="Nothing scheduled further out." render={render} />
      </S8Card>
      <S8Card title="Recent past">
        <S8List
          items={recentPast}
          empty="No past sessions yet."
          render={(r: any) => (
            <S8Item key={r.id} title={r.session?.offering?.title ?? "Class"} meta={dateTime(r.session?.date, r.session?.startTime) + " · " + (r.session?.topic ?? "")} status={attendanceStatusLabel(r.status)} />
          )}
        />
      </S8Card>
    </S8Page>
  );
}
