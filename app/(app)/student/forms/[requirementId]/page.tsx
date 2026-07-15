import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentFormRequirement } from "@/lib/session8/student-portal";
import { S8Page, S8Card, S8Item } from "@/components/session8/portal-ui";
import { shortDate } from "@/lib/session8/format";
import { familyFormRequirementStatusLabel } from "@/lib/session8/labels";

export default async function Page({ params }: { params: Promise<{ requirementId: string }> }) {
  const { requirementId } = await params;
  const user = await requireStudentPortalUser();
  const req: any = await getStudentFormRequirement(user.id, requirementId);
  if (!req) notFound();

  const latestSubmission = req.submissions?.[0] ?? null;
  const template = req.version?.template;
  const fields: any[] = Array.isArray(req.version?.content?.fields) ? req.version.content.fields : [];

  const whyReasons = [
    req.blocksEnrollment ? "This form must be completed before enrollment can be confirmed." : null,
    req.blocksAttendance ? "This form must be completed before attendance can be recorded." : null,
  ].filter(Boolean) as string[];

  return (
    <S8Page
      eyebrow="Student forms"
      title={template?.title ?? "Required form"}
      body={req.reason ?? "This form requires a parent or guardian signature and cannot be completed from the student portal."}
      primaryHref="/student/forms"
      primaryLabel="Back to forms"
    >
      <S8Card title="Status">
        <S8Item title={template?.title ?? "Form"} meta={req.offering?.title ? `For ${req.offering.title}` : "General requirement"} status={familyFormRequirementStatusLabel(req.status)}>
          {req.dueAt ? <>Due {shortDate(req.dueAt)}</> : "No due date set."}
        </S8Item>
        {whyReasons.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {whyReasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        ) : null}
      </S8Card>

      {fields.length ? (
        <S8Card title="What this form asks for">
          <ul className="space-y-2 text-sm text-slate-600">
            {fields.map((f: any, i: number) => (
              <li key={f.key ?? i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{f.label ?? f.prompt ?? `Field ${i + 1}`}</p>
                {f.prompt && f.label ? <p className="mt-1">{f.prompt}</p> : null}
              </li>
            ))}
          </ul>
        </S8Card>
      ) : null}

      <S8Card title="A parent or guardian needs to complete this">
        <p className="text-sm text-slate-600">
          Every YPP family form requires a parent or guardian&apos;s signature, so it can&apos;t be finished here in the
          Student Portal. Ask your parent or guardian to open the Parent Portal and go to Forms — this requirement will
          be waiting for them there.
        </p>
        {req.status === "COMPLETED" && latestSubmission ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">
            Completed by your guardian on {shortDate(latestSubmission.createdAt)}.
            {latestSubmission.staffReviewState && latestSubmission.staffReviewState !== "NOT_REQUIRED"
              ? ` Staff review: ${latestSubmission.staffReviewState.replaceAll("_", " ").toLowerCase()}.`
              : ""}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No submission has been recorded yet.</p>
        )}
        <Link href="/student/forms" className="mt-4 inline-block rounded-full border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to your forms
        </Link>
      </S8Card>
    </S8Page>
  );
}
