import { requireGuardianPortalUser } from "@/lib/family-access";
import { getParentScopedCertificates } from "@/lib/session8/student-portal";
import { S8Page, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";

export default async function Page() {
  const u = await requireGuardianPortalUser();
  const groups = await getParentScopedCertificates(u.id);

  return (
    <S8Page eyebrow="Parent portal" title="Certificates" body="Class-completion certificates for the students you have permission to view. Guardians without learning-visibility permission for a student will not see that student here.">
      {groups.length ? (
        groups.map((g: any) => (
          <S8Card key={g.relationship.id} title={`${g.relationship.studentUser?.name ?? "Student"}'s certificates`}>
            <S8List
              items={g.certificates}
              empty="No certificates issued yet."
              render={(c: any) => (
                <S8Item key={c.id} title={c.title} meta={"Issued " + shortDate(c.issuedAt) + " · ID " + c.certificateNumber} status={c.template?.type}>
                  {c.offering ? <>Linked class: {c.offering.title ?? c.offering.template?.title}. </> : null}
                  {c.pdfUrl ? <>Downloadable file available.</> : <>Record only — no downloadable file has been attached yet.</>}
                </S8Item>
              )}
            />
          </S8Card>
        ))
      ) : (
        <S8Card title="No students available">
          <p className="text-sm text-slate-600">You don&apos;t currently have learning-visibility permission for any linked student, or no students are linked to your account yet.</p>
        </S8Card>
      )}
    </S8Page>
  );
}
