import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageRoles } from "@/lib/page-guards";
import ExternalApplicantIntakeForm from "./intake-form";

export const dynamic = "force-dynamic";

/**
 * Admin-only page for entering an external applicant (Google Forms / manual
 * admin entry) into the YPP review pipeline. The form posts to the
 * `createExternalInstructorApplicantFromForm` server action — the resulting
 * InstructorApplication is identical in shape to a portal-native one and
 * enters the same review/interview/chair workflow.
 *
 * CSV bulk import is not exposed here yet (see lib/csv-import-actions.ts) —
 * leaving a clean TODO so we don't ship a half-baked bulk upload UI.
 */
export default async function NewExternalApplicantPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string; pipeline?: string }>;
}) {
  const sessionUser = await requirePageRoles(["ADMIN", "CHAPTER_PRESIDENT"]);
  const roles = sessionUser.roles;
  const isAdmin = roles.includes("ADMIN");
  const params = await searchParams;

  // Chapter list — admins see all, Chapter Presidents are locked to their own.
  let chapters: Array<{ id: string; name: string }> = [];
  let scopedChapterId: string | null = null;
  if (isAdmin) {
    chapters = await prisma.chapter.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    const me = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { chapterId: true, chapter: { select: { id: true, name: true } } },
    });
    scopedChapterId = me?.chapterId ?? null;
    chapters = me?.chapter ? [me.chapter] : [];
  }

  const staffPositions = isAdmin
    ? await prisma.position.findMany({
        where: { type: "STAFF", isOpen: true },
        select: {
          id: true,
          title: true,
          chapter: { select: { name: true } },
        },
        orderBy: { title: "asc" },
      })
    : [];

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Add External Applicant</h1>
          <p className="page-subtitle">
            External intake, internal review. Use this form to record a Google
            Forms applicant or to manually enter an applicant you spoke with
            outside the portal. The application enters the same review,
            interview, and chair-decision pipeline as portal-native ones.
          </p>
        </div>
        <div>
          <Link href="/admin/instructor-applicants" className="button outline small">
            Back to pipeline
          </Link>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 20,
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
        }}
      >
        <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#1e3a8a" }}>
          What happens after I submit?
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            fontSize: 13,
            color: "#1e3a8a",
            lineHeight: 1.6,
          }}
        >
          <li>
            A portal User is created (or linked) for the applicant. Their account
            is in &quot;applicant&quot; mode — they can claim it later via the
            existing sign-in flow.
          </li>
          <li>
            An application is created in the matching review pipeline — an
            InstructorApplication routed to your chapter&apos;s default reviewer
            (if configured), a staff/org application in Admin Recruiting, or a
            ChapterPresidentApplication on the chapter president board — so it
            lands in the review queue immediately.
          </li>
          <li>
            A &quot;Send application confirmation&quot; task is queued in the
            manual email tracker so you remember to acknowledge the applicant.
            No email is auto-sent — you copy/paste the suggested subject and
            body into your email client.
          </li>
        </ul>
      </div>

      {params.created && (
        <div
          className="card"
          role="status"
          style={{
            marginBottom: 20,
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            color: "#065f46",
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
            Applicant added to the pipeline.
          </p>
          <Link
            href={
              params.pipeline === "staff"
                ? `/applications/${params.created}`
                : `/applications/instructor/${params.created}`
            }
            className="link"
            style={{ color: "#065f46", textDecoration: "underline" }}
          >
            Open applicant record →
          </Link>
        </div>
      )}

      {params.error && (
        <div
          className="card"
          role="alert"
          style={{
            marginBottom: 20,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#7f1d1d",
          }}
        >
          {params.error}
        </div>
      )}

      <ExternalApplicantIntakeForm
        chapters={chapters}
        staffPositions={staffPositions.map((position) => ({
          id: position.id,
          title: position.title,
          chapterName: position.chapter?.name ?? null,
        }))}
        scopedChapterId={scopedChapterId}
        isAdmin={isAdmin}
      />

      <div
        className="card"
        style={{ marginTop: 20, fontSize: 13, color: "var(--muted)" }}
      >
        <strong>Need to bulk-import?</strong> CSV / Google Sheet bulk import
        is supported by the back-end (
        <code>lib/csv-import-actions.ts</code>) but does not yet have a
        first-class admin UI. Until that ships, use this form for one-off
        entries or contact engineering for a batch run.
      </div>
    </div>
  );
}
