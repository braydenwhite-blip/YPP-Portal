import { requireGuardianPortalUser } from "@/lib/family-access";
import { getParentScopedProgress } from "@/lib/session8/student-portal";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";
import { classEnrollmentStatusLabel } from "@/lib/session8/labels";

export default async function Page() {
  const u = await requireGuardianPortalUser();
  const groups = await getParentScopedProgress(u.id);
  return (
    <S8Page eyebrow="Parent progress" title="Progress, feedback, and completion" body="Guardians see only family-released feedback, completion, and certificates for authorized students.">
      {groups.map((g: any) => (
        <S8Grid key={g.relationship.id}>
          <S8Card title={`${g.relationship.studentUser?.name} completed`}>
            <S8List items={g.progress.completed} empty="No completed classes." render={(e: any) => <S8Item key={e.id} title={e.offering?.title ?? "Class"} meta={shortDate(e.completedAt)} status={classEnrollmentStatusLabel(e.status)} />} />
          </S8Card>
          <S8Card title="Feedback the student shared">
            <S8List items={g.progress.feedback} empty="No feedback submitted by the student." render={(f: any) => <S8Item key={f.id} title={f.offering?.title ?? "Feedback"}>{f.liked}</S8Item>} />
          </S8Card>
          <S8Card title="Feedback from instructors">
            <S8List items={g.progress.instructorFeedback} empty="No instructor feedback has been released." render={(f: any) => <S8Item key={f.id} title={f.offering?.title ?? "Feedback"} meta={shortDate(f.releasedToFamilyAt)}>{f.body}</S8Item>} />
          </S8Card>
          <S8Card title="Certificates">
            <S8List items={g.progress.certificates} empty="No certificates." render={(c: any) => <S8Item key={c.id} title={c.title} meta={shortDate(c.issuedAt)} status={c.template?.type} />} />
          </S8Card>
        </S8Grid>
      ))}
    </S8Page>
  );
}
