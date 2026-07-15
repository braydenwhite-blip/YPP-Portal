import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentProgress } from "@/lib/session8/student-portal";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";
import { classEnrollmentStatusLabel } from "@/lib/session8/labels";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const p = await getStudentProgress(u.id);

  return (
    <S8Page eyebrow="Progress" title="Your YPP participation" body="Completed classes, feedback, and certificates — presented without grades, rubrics, or private instructor notes.">
      <S8Grid>
        <S8Card title="Completed classes">
          <S8List items={p.completed} empty="No completed classes yet." render={(e: any) => <S8Item key={e.id} title={e.offering?.title ?? "Completed class"} meta={shortDate(e.completedAt)} status={classEnrollmentStatusLabel(e.status)} href={`/student/learning/classes/${e.offeringId}`} />} />
        </S8Card>

        <S8Card title="Attendance consistency">
          <S8List
            items={p.attendanceConsistency}
            empty="No attendance recorded yet."
            render={(a: any) => <S8Item key={a.offeringId} title={a.title}>{a.present} of {a.total} sessions attended</S8Item>}
          />
        </S8Card>

        <S8Card title="Feedback you shared">
          <S8List items={p.feedback} empty="You haven't submitted feedback yet." render={(f: any) => <S8Item key={f.id} title={f.offering?.title ?? "Feedback"} meta={shortDate(f.createdAt)}>{f.liked ?? "Your submitted feedback."}</S8Item>} />
        </S8Card>

        <S8Card title="Feedback from your instructors">
          <S8List items={p.instructorFeedback} empty="No instructor feedback has been released yet." render={(f: any) => <S8Item key={f.id} title={f.offering?.title ?? "Feedback"} meta={shortDate(f.releasedToFamilyAt)}>{f.body}</S8Item>} />
        </S8Card>

        <S8Card title="Certificates" actionHref="/student/certificates">
          <S8List items={p.certificates} empty="No certificates issued yet." render={(c: any) => <S8Item key={c.id} title={c.title} meta={shortDate(c.issuedAt)} status={c.template?.type} />} />
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
