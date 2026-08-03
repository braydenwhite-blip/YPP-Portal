import {
  ButtonLink,
  DataTableShell,
  EmptyStateV2,
} from "@/components/ui-v2";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";
import { loadMenteeHomeDocuments } from "@/lib/mentorship/mentee-home-documents";
import { MenteeHomeDocumentsTable } from "./mentee-home-documents-table";
import { NewReviewDocumentButton } from "./new-review-document-button";

/**
 * Mentee home — profile header + Reviews & Documents table (mockup).
 */

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function personWithTitle(name: string | null | undefined, title: string | null | undefined) {
  if (!name) return null;
  return title ? `${name} (${title})` : name;
}

function MetaField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="m-0 text-[11px] font-medium text-ink-muted">{label}</p>
      <p className="m-0 mt-0.5 text-[13.5px] font-semibold leading-snug text-ink">{value}</p>
    </div>
  );
}

export async function MenteeDashboardHome({
  workspace,
  goalsHref,
  reviewsHref,
  personBasePath,
}: {
  workspace: MentorshipWorkspace;
  goalsHref: string;
  reviewsHref: string;
  /** e.g. /mentorship/people/:id — used by New Review create → open */
  personBasePath: string;
}) {
  const { person, overview } = workspace;
  const documents = await loadMenteeHomeDocuments({
    menteeId: person.id,
    goalsHref,
    reviewsHref,
  });

  const roleBadge = person.title
    ? `${person.roleLabel} · ${person.title}`
    : person.roleLabel;

  const mentorDisplay = personWithTitle(overview.mentorName, overview.mentorTitle);
  const chairDisplay = personWithTitle(overview.chairName, overview.chairTitle);

  const canCreateReviewDoc =
    !workspace.isSelf &&
    Boolean(workspace.activeMentorshipId) &&
    (workspace.isMentor || workspace.isAdmin || workspace.isLeadership);
  const canManageDocs =
    !workspace.isSelf &&
    (workspace.isMentor || workspace.isAdmin || workspace.isLeadership);

  const toolbar = canCreateReviewDoc ? (
    <NewReviewDocumentButton
      mentorshipId={workspace.activeMentorshipId!}
      menteeId={person.id}
      basePath={personBasePath}
    />
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[16px] border border-line-soft bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.avatarUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-brand-100"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[22px] font-bold text-brand-800"
              >
                {initials(person.name)}
              </div>
            )}
            <div className="min-w-0 pt-1">
              {workspace.isSelf ? (
                <p className="m-0 text-[13px] text-ink-muted">Welcome back,</p>
              ) : null}
              <h2
                className={[
                  "m-0 text-[26px] font-bold tracking-[-0.03em] text-ink sm:text-[30px]",
                  workspace.isSelf ? "mt-0.5" : "",
                ].join(" ")}
              >
                {person.name}
              </h2>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200">
                <span
                  aria-hidden
                  className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-200 text-[9px] font-bold text-brand-800"
                >
                  {initials(person.name).slice(0, 1)}
                </span>
                {roleBadge}
              </span>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:max-w-[640px] lg:grid-cols-3">
            <MetaField label="Department" value={person.departmentName} />
            <MetaField label="Location" value={person.location} />
            <MetaField label="Role Chair" value={chairDisplay} />
            <MetaField label="Hometown" value={person.hometown} />
            <MetaField label="Grade / Level" value={person.gradeLabel} />
            <MetaField label="Next Review" value={overview.nextReviewLabel} />
            <MetaField label="Hire Date" value={person.hireDateLabel} />
            <MetaField label="Mentor" value={mentorDisplay ?? "Not paired yet"} />
          </div>
        </div>
      </section>

      <DataTableShell className="rounded-[16px]">
        {documents.length === 0 ? (
          <div className="px-5 py-8">
            {toolbar ? (
              <div className="mb-4 flex justify-end">{toolbar}</div>
            ) : null}
            <EmptyStateV2
              title="Nothing here yet"
              body={
                workspace.isSelf
                  ? "When your mentor starts a review or your G&R is set up, it will show up in this table."
                  : "When a review starts or G&R is set up for this mentee, it will show up here."
              }
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href={goalsHref} variant="secondary" size="sm">
                Open G&amp;R
              </ButtonLink>
              <ButtonLink href={reviewsHref} variant="secondary" size="sm">
                Review
              </ButtonLink>
            </div>
          </div>
        ) : (
          <MenteeHomeDocumentsTable
            menteeId={person.id}
            documents={documents}
            canManage={canManageDocs}
            toolbar={toolbar}
          />
        )}
      </DataTableShell>
    </div>
  );
}
