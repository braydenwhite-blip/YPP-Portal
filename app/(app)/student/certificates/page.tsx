import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentCertificates } from "@/lib/session8/student-portal";
import { S8Page, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const certs = await getStudentCertificates(u.id);

  return (
    <S8Page eyebrow="Certificates" title="Your YPP certificates" body="Class-completion certificates are linked one-to-one with a completed class and can't be issued twice for the same class.">
      <S8Card title="Issued certificates">
        <S8List
          items={certs}
          empty="No certificates have been issued yet."
          render={(c: any) => (
            <S8Item
              key={c.id}
              title={c.title}
              meta={"Issued " + shortDate(c.issuedAt) + " · ID " + c.certificateNumber}
              status={c.template?.type}
              href={c.offering ? `/student/learning/classes/${c.offering.id}` : undefined}
            >
              {c.offering ? <>Linked class: {c.offering.title ?? c.offering.template?.title}. </> : null}
              {c.pdfUrl ? <>Downloadable file available.</> : <>Record only — no downloadable file has been attached yet.</>}
            </S8Item>
          )}
        />
      </S8Card>
    </S8Page>
  );
}
