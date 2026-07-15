import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentLearningHub } from "@/lib/session8/student-portal";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime, shortDate } from "@/lib/session8/format";
import { classEnrollmentStatusLabel, familyFormRequirementStatusLabel, familyWaitlistStatusLabel, guardianApprovalStatusLabel } from "@/lib/session8/labels";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const d = await getStudentLearningHub(u.id);
  return (
    <S8Page eyebrow="My Learning" title="Your YPP participation" body="Active classes, upcoming sessions, applications, waitlists, forms, completed programs, and certificates in one safe view." primaryHref="/student/explore" primaryLabel="Explore">
      <S8Grid>
        <S8Card title="Active Now">
          <S8List items={d.active} empty="No active classes." render={(e: any) => <S8Item key={e.id} title={e.offering?.title ?? "Class"} meta={(e.offering?.meetingDays ?? []).join(", ") + " · " + (e.offering?.meetingTime ?? "Schedule pending")} status={classEnrollmentStatusLabel(e.status)} href={`/student/learning/classes/${e.offeringId}`}>Instructor: {e.offering?.instructor?.name ?? "YPP instructor"}</S8Item>} />
        </S8Card>
        <S8Card title="Coming Up">
          <S8List items={d.schedule.slice(0, 6)} empty="No upcoming sessions." render={(i: any) => <S8Item key={i.session.id} title={i.title} meta={dateTime(i.date, i.time)} status={i.status} href={i.href ?? undefined}>{i.location}</S8Item>} />
        </S8Card>
        <S8Card title="Applications">
          <S8List
            items={d.applications}
            empty="No pending applications right now."
            render={(a: any) => (
              <S8Item key={a.kind + a.title + (a.offeringId ?? "")} title={a.title} meta={shortDate(a.date)} status={a.kind === "Guardian approval" ? guardianApprovalStatusLabel(a.status) : familyWaitlistStatusLabel(a.status)} href={a.href}>
                {a.kind === "Guardian approval" ? "Waiting for a parent or guardian to approve." : "Waiting for a seat to open."}
              </S8Item>
            )}
          />
        </S8Card>
        <S8Card title="Forms">
          <S8List items={d.forms} empty="No required forms." render={(f: any) => <S8Item key={f.id} title={f.version?.template?.title ?? "Form"} meta={shortDate(f.dueAt)} status={familyFormRequirementStatusLabel(f.status)} href={`/student/forms/${f.id}`} />} />
        </S8Card>
        <S8Card title="Completed">
          <S8List items={d.completed} empty="No completed programs yet." render={(e: any) => <S8Item key={e.id} title={e.offering?.title ?? "Class"} meta={shortDate(e.completedAt)} status={classEnrollmentStatusLabel(e.status)} href={`/student/learning/classes/${e.offeringId}`} />} />
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
