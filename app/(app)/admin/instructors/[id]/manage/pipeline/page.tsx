import Link from "next/link";
import { redirect } from "next/navigation";

import {
  formatInstructorOpsDate,
  formatInstructorOpsDateTime,
  formatInstructorOpsLabel,
} from "@/lib/instructor-ops";
import { InfoGrid, SectionHeading } from "../_components/parts";
import { asArray, loadManagePipelineData } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManagePipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadManagePipelineData(id);
  if (!data) redirect("/");

  const { profile } = data;
  const { record, user, readiness } = profile;
  const instructorApplications = asArray(user.instructorApplications);

  return (
    <section className="card instructor-profile-section">
      <SectionHeading
        title="Pipeline & onboarding"
        detail="Current stage, blockers, and application history."
      />
      <div className="instructor-profile-two-column">
        <div>
          <h3>Current stage</h3>
          <div className="instructor-profile-stage-card">
            <span
              className={`pill ${record.needsAttention ? "pill-attention" : "pill-purple"}`}
            >
              {record.stageLabel}
            </span>
            <strong>{record.stageDetail}</strong>
            <span>Latest activity: {formatInstructorOpsDateTime(record.latestActivityAt)}</span>
          </div>

          <h3 style={{ marginTop: 18 }}>Attention flags</h3>
          {record.attentionFlags.length === 0 ? (
            <p className="instructor-profile-muted">No active attention flags.</p>
          ) : (
            <div className="instructor-ops-attention-list">
              {record.attentionFlags.map((flag) => (
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
          )}
        </div>

        <div>
          <h3>Readiness</h3>
          <InfoGrid
            items={[
              ["Readiness complete", readiness.baseReadinessComplete ? "Yes" : "No"],
              [
                "Can request offering approval",
                readiness.canRequestOfferingApproval ? "Yes" : "No",
              ],
              ["Training complete", readiness.trainingComplete ? "Yes" : "No"],
              ["Interview status", formatInstructorOpsLabel(readiness.interviewStatus)],
              ["Onboarding profile", record.onboardingComplete ? "Complete" : "Incomplete"],
              ["Subtype", formatInstructorOpsLabel(readiness.instructorSubtype)],
            ]}
          />
          {readiness.missingRequirements.length > 0 ? (
            <div className="instructor-profile-blocker-list">
              {readiness.missingRequirements.map((requirement) => (
                <Link key={requirement.code} href={requirement.href}>
                  <strong>{requirement.title}</strong>
                  <span>{requirement.detail}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="instructor-profile-history">
        <h3>Application history</h3>
        {instructorApplications.length === 0 ? (
          <p className="instructor-profile-muted">No instructor application records found.</p>
        ) : (
          instructorApplications.map((application: any) => (
            <Link
              key={application.id}
              href={`/admin/instructor-applicants/${application.id}`}
              className="instructor-profile-history-row"
            >
              <span>{formatInstructorOpsLabel(application.status)}</span>
              <strong>{formatInstructorOpsLabel(application.applicationTrack)}</strong>
              <small>Updated {formatInstructorOpsDate(application.updatedAt)}</small>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}
