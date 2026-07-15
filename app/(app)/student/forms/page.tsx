import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentForms } from "@/lib/session8/student-portal";
import { S8Page, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";
import { familyFormRequirementStatusLabel } from "@/lib/session8/labels";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const forms: any[] = await getStudentForms(u.id);
  const actionable = forms.filter((f) => f.status === "REQUIRED" || f.status === "IN_PROGRESS");
  const done = forms.filter((f) => f.status === "COMPLETED" || f.status === "WAIVED" || f.status === "SUPERSEDED");

  const why = (f: any) => {
    const reasons: string[] = [];
    if (f.blocksEnrollment) reasons.push("Needed to confirm enrollment");
    if (f.blocksAttendance) reasons.push("Needed before attendance can be recorded");
    return reasons.join(" · ") || "Requested by YPP staff";
  };

  return (
    <S8Page eyebrow="Student forms" title="Forms that need your family's attention" body="Every YPP family form requires a parent or guardian signature. Open a form to see what it's for and who needs to complete it.">
      <S8Card title="Needs action">
        <S8List
          items={actionable}
          empty="No forms are waiting right now."
          render={(f: any) => (
            <S8Item key={f.id} title={f.version?.template?.title ?? "YPP form"} meta={(f.offering?.title ?? "General") + (f.dueAt ? " · Due " + shortDate(f.dueAt) : "")} status={familyFormRequirementStatusLabel(f.status)} href={`/student/forms/${f.id}`}>
              {why(f)}
            </S8Item>
          )}
        />
      </S8Card>
      <S8Card title="Completed">
        <S8List
          items={done}
          empty="No completed forms yet."
          render={(f: any) => (
            <S8Item key={f.id} title={f.version?.template?.title ?? "YPP form"} meta={f.offering?.title ?? "General"} status={familyFormRequirementStatusLabel(f.status)} href={`/student/forms/${f.id}`} />
          )}
        />
      </S8Card>
    </S8Page>
  );
}
