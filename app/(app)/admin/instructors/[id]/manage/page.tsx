import Link from "next/link";
import { redirect } from "next/navigation";

import {
  formatInstructorOpsDateTime,
  formatInstructorOpsLabel,
} from "@/lib/instructor-ops";
import { TagsEditor } from "../profile-editor";
import {
  InfoGrid,
  ManageSectionLinks,
  SectionHeading,
  Signal,
} from "./_components/parts";
import { asArray, loadManageOverviewData } from "./_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManageOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadManageOverviewData(id);
  if (!data) redirect("/");

  const { profile, detail, allTags } = data;
  const { record, user, readiness } = profile;
  const activeApplication = asArray(user.instructorApplications)[0] ?? null;

  const sectionItems = [
    {
      href: "pipeline",
      title: "Pipeline & onboarding",
      detail: "Stage, readiness blockers, and application history.",
      count: record.attentionFlags.length + readiness.missingRequirements.length,
    },
    {
      href: "teaching",
      title: "Teaching & mentorship",
      detail: "Class offerings, permissions, and mentor relationships.",
      count: record.activeAssignmentCount,
    },
    {
      href: "strategy",
      title: "Reviews & people strategy",
      detail: "Quarterly reviews, leadership roles, and linked actions.",
    },
    {
      href: "notes",
      title: "Notes & activity",
      detail: "Admin notes, tasks, and timeline events.",
      count: detail.notes.length + detail.tasks.length,
    },
  ];

  return (
    <>
      {record.needsAttention && record.attentionFlags.length > 0 ? (
        <section className="card instructor-profile-section">
          <SectionHeading
            title="Needs attention"
            detail="Open the pipeline tab to resolve these first."
          />
          <div className="instructor-ops-attention-list">
            {record.attentionFlags.slice(0, 3).map((flag) => (
              <Link
                key={flag.kind}
                href={flag.href}
                className={`instructor-ops-attention-item is-${flag.tone}`}
              >
                <strong>{flag.title}</strong>
                <span>{flag.detail}</span>
              </Link>
            ))}
          </div>
          {record.attentionFlags.length > 3 ? (
            <p className="instructor-profile-muted" style={{ marginTop: 12 }}>
              +{record.attentionFlags.length - 3} more in{" "}
              <Link href={`/admin/instructors/${id}/manage/pipeline`}>Pipeline</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card instructor-profile-section">
        <SectionHeading title="Contact & profile" detail="Core identity and admin tags." />
        <div className="instructor-profile-two-column">
          <InfoGrid
            items={[
              ["Email", record.email],
              ["Phone", record.phone ?? "Not recorded"],
              ["Chapter", record.chapterName],
              [
                "Location",
                record.chapterLocation ?? user.profile?.city ?? "Not recorded",
              ],
              [
                "School",
                user.profile?.school ?? activeApplication?.schoolName ?? "Not recorded",
              ],
              ["Roles", record.roles.join(", ") || "None"],
              ["Stage detail", record.stageDetail],
              [
                "Latest activity",
                formatInstructorOpsDateTime(record.latestActivityAt),
              ],
            ]}
          />
          <div>
            <TagsEditor
              userId={id}
              initialTags={detail.tags}
              allTags={allTags.map((t) => ({
                id: t.id,
                namespace: t.namespace,
                label: t.label,
                color: t.color,
              }))}
            />
            <div className="instructor-profile-signal-grid" style={{ marginTop: 16 }}>
              <Signal label="Mentor eligible" value={record.mentorEligible ? "Yes" : "No"} />
              <Signal
                label="Workshop eligible"
                value={record.workshopEligible ? "Yes" : "No"}
              />
              <Signal
                label="Leadership track"
                value={record.leadershipTrack ? "Yes" : "No"}
              />
              <Signal
                label="Growth tier"
                value={
                  record.growthTier
                    ? formatInstructorOpsLabel(record.growthTier)
                    : "Not started"
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card instructor-profile-section">
        <SectionHeading
          title="Go to a section"
          detail="Each area is its own page — pick what you need to work on."
        />
        <ManageSectionLinks instructorId={id} items={sectionItems} />
      </section>
    </>
  );
}
