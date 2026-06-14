import { notFound, redirect } from "next/navigation";

import { InstructorManageHeader } from "./_components/header";
import { InstructorManageNav } from "./_components/nav";
import { CompletenessBanner, ProfileMetric } from "./_components/parts";
import { getManageProfile, requireManageAdmin } from "./_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireManageAdmin();
  if (!session) redirect("/");

  const profile = await getManageProfile(id);
  if (!profile) notFound();

  const { record } = profile;

  return (
    <div className="instructor-ops-page instructor-profile-page">
      <InstructorManageHeader id={id} profile={profile} />

      <div className="grid four instructor-ops-metrics">
        <ProfileMetric label="Stage" value={record.stageLabel} detail={record.currentLoadLabel} />
        <ProfileMetric
          label="Assignments"
          value={String(record.activeAssignmentCount)}
          detail={`${record.assignmentCount} total`}
        />
        <ProfileMetric
          label="Training"
          value={`${record.trainingPercent}%`}
          detail={`${record.trainingCompleted}/${record.trainingTotal} modules`}
        />
        <ProfileMetric
          label="Attention"
          value={String(record.attentionFlags.length)}
          detail={record.attentionFlags[0]?.title ?? "No active flags"}
        />
      </div>

      <CompletenessBanner completeness={record.completeness} />
      <InstructorManageNav instructorId={id} />

      <div className="instructor-manage-content">{children}</div>
    </div>
  );
}
