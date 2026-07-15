import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentClassSpace } from "@/lib/session8/student-portal";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime, shortDate } from "@/lib/session8/format";
import { attendanceStatusLabel, classEnrollmentStatusLabel } from "@/lib/session8/labels";

const supportLinks = (offeringId: string, sessionId?: string) => {
  const base = (category: string) => `/student/support?category=${encodeURIComponent(category)}&offeringId=${offeringId}${sessionId ? `&sessionId=${sessionId}` : ""}`;
  return [
    { label: "Report absence", href: base("I cannot attend a session") },
    { label: "Technical issue", href: base("I cannot access the meeting") },
    { label: "Class question", href: base("I have a question about a class") },
    { label: "Schedule issue", href: base("I have a schedule issue") },
    { label: "Safety concern", href: base("I do not feel comfortable") },
  ];
};

export default async function Page({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const u = await requireStudentPortalUser();
  const d: any = await getStudentClassSpace(u.id, classId);
  if (!d) notFound();
  const wait = d.enrollment.status === "WAITLISTED";
  const completed = d.enrollment.status === "COMPLETED";
  const links = supportLinks(classId);

  return (
    <S8Page eyebrow="Class space" title={d.offering.title ?? d.offering.template?.title ?? "YPP class"} body={d.offering.template?.description ?? "Your student-facing class operating space with sessions, participation, updates, support, and completion."} primaryHref="/student/support" primaryLabel="Get support">
      <S8Grid cols={2}>
        <S8Card title="Overview" subtitle="Family-visible class details">
          <p>Instructor: {d.offering.instructor?.name ?? "YPP instructor"}</p>
          <p>Program: {d.offering.template?.title ?? "YPP program"}</p>
          <p>Chapter: {d.offering.chapter?.name ?? "YPP"}</p>
          <p>Partner: {d.offering.partner?.name ?? "Not listed"}</p>
          <p>Format: {d.offering.deliveryMode === "VIRTUAL" ? "Online" : d.offering.deliveryMode === "IN_PERSON" ? "In person" : "Mixed online and in person"}</p>
          <p>Location: {wait ? "Shared after enrollment" : (d.offering.locationName ?? (d.offering.zoomLink ? "Authorized join information available" : "Location pending"))}</p>
        </S8Card>

        <S8Card title="Next Session">
          <S8List items={d.offering.sessions.filter((s: any) => new Date(s.date) >= new Date()).slice(0, 1)} empty="No upcoming session." render={(s: any) => <S8Item key={s.id} title={s.topic} meta={dateTime(s.date, s.startTime)} status={s.isCancelled ? "CANCELLED" : "SCHEDULED"} href={wait ? undefined : `/student/learning/sessions/${s.id}`}>{wait ? "Waitlisted students receive status only until enrolled." : (s.description ?? "Come ready to participate.")}</S8Item>} />
        </S8Card>

        <S8Card title="Sessions">
          <S8List items={d.offering.sessions} empty="No sessions listed." render={(s: any) => <S8Item key={s.id} title={`Session ${s.sessionNumber}: ${s.topic}`} meta={dateTime(s.date, s.startTime)} status={s.isCancelled ? "CANCELLED" : "SCHEDULED"} href={wait ? undefined : `/student/learning/sessions/${s.id}`}>{d.attendance.find((a: any) => a.sessionId === s.id) ? attendanceStatusLabel(d.attendance.find((a: any) => a.sessionId === s.id)?.status) : "Attendance pending"}</S8Item>} />
        </S8Card>

        <S8Card title="Participation">
          <p>Status: {classEnrollmentStatusLabel(d.enrollment.status)}</p>
          <p>Attendance summary: {d.enrollment.sessionsAttended} sessions attended.</p>
          <p>Completion: {d.enrollment.completedAt ? shortDate(d.enrollment.completedAt) : "Not complete yet"}</p>
          {completed ? (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              {d.certificate ? (
                <p className="text-sm font-medium text-emerald-800">Certificate issued {shortDate(d.certificate.issuedAt)}. <Link href="/student/certificates" className="underline">View certificates</Link></p>
              ) : (
                <p className="text-sm text-emerald-800">This class is complete. A certificate will appear on your <Link href="/student/certificates" className="underline">Certificates</Link> page if one is issued.</p>
              )}
            </div>
          ) : null}
        </S8Card>

        {d.feedback?.length ? (
          <S8Card title="Feedback from your instructor">
            <S8List items={d.feedback} empty="" render={(f: any) => <S8Item key={f.id} title="Instructor feedback" meta={shortDate(f.releasedToFamilyAt)}>{f.body}</S8Item>} />
          </S8Card>
        ) : null}

        <S8Card title="Class Updates">
          <S8List items={d.offering.announcements ?? []} empty="No class updates." render={(a: any) => <S8Item key={a.id} title={a.title ?? "Update"} meta={shortDate(a.createdAt)}>{a.body ?? a.summary}</S8Item>} />
        </S8Card>

        <S8Card title="Support actions">
          <div className="flex flex-wrap gap-2 text-sm">
            {links.map((l) => <Link key={l.label} className="rounded-full border px-3 py-2" href={l.href}>{l.label}</Link>)}
          </div>
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
