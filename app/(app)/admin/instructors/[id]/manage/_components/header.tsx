import Link from "next/link";

import type { getInstructorOpsProfile } from "@/lib/instructor-ops";

type Profile = NonNullable<Awaited<ReturnType<typeof getInstructorOpsProfile>>>;

export function InstructorManageHeader({
  id,
  profile,
}: {
  id: string;
  profile: Profile;
}) {
  const { record } = profile;

  return (
    <div className="instructor-profile-hero">
      <div className="instructor-profile-identity">
        <div className="instructor-profile-avatar" aria-hidden="true">
          {record.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.avatarUrl} alt="" />
          ) : (
            record.name.slice(0, 2).toUpperCase()
          )}
        </div>
        <div>
          <div className="instructor-profile-breadcrumbs">
            <Link href="/people?role=instructor">People</Link>
            <span>/</span>
            <Link href={`/admin/instructors/${id}`}>Record</Link>
            <span>/</span>
            <span>Manage</span>
          </div>
          <p className="badge">{record.stageLabel}</p>
          <h1 className="page-title">{record.name}</h1>
          <p className="page-subtitle">
            {record.email} · {record.chapterName}
          </p>
        </div>
      </div>
      <div className="instructor-profile-actions">
        {record.application ? (
          <Link
            href={`/admin/instructor-applicants/${record.application.id}`}
            className="button secondary"
          >
            Open application
          </Link>
        ) : null}
        <Link href={`/admin/instructors/${id}`} className="button">
          Back to record
        </Link>
      </div>
    </div>
  );
}
