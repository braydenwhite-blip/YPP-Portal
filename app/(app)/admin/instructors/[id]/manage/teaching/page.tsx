import Link from "next/link";
import { redirect } from "next/navigation";

import { formatInstructorOpsDate, formatInstructorOpsLabel } from "@/lib/instructor-ops";
import { SectionHeading } from "../_components/parts";
import { asArray, loadManageTeachingData } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManageTeachingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadManageTeachingData(id);
  if (!data) redirect("/");

  const { profile } = data;
  const { user } = profile;
  const classOfferings = asArray(user.classOfferingsInstructed);
  const courses = asArray(user.courses);
  const coInstructorAssignments = asArray(user.coInstructorAssignments);
  const teachingPermissions = asArray(user.teachingPermissions);
  const instructorCertifications = asArray(user.instructorCertifications);
  const menteePairs = asArray(user.menteePairs);
  const mentorPairs = asArray(user.mentorPairs);

  return (
    <>
      <section className="card instructor-profile-section">
        <SectionHeading
          title="Class assignments"
          detail="Offerings, legacy courses, permissions, and certifications."
        />
        <div className="instructor-profile-assignment-grid">
          <div>
            <h3>Class offerings</h3>
            <div className="instructor-profile-stack">
              {classOfferings.length === 0 ? (
                <p className="instructor-profile-muted">No class offerings assigned.</p>
              ) : (
                classOfferings.map((offering: any) => (
                  <Link
                    key={offering.id}
                    href={`/admin/classes/${offering.id}`}
                    className="instructor-profile-assignment-row"
                  >
                    <strong>{offering.title}</strong>
                    <span>
                      {formatInstructorOpsLabel(offering.status)} ·{" "}
                      {offering.template.interestArea}
                    </span>
                    <small>
                      Approval:{" "}
                      {formatInstructorOpsLabel(offering.approval?.status ?? "NOT_REQUESTED")}
                    </small>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div>
            <h3>Courses & co-instructor roles</h3>
            <div className="instructor-profile-stack">
              {courses.map((course: any) => (
                <div key={course.id} className="instructor-profile-assignment-row">
                  <strong>{course.title}</strong>
                  <span>
                    {course.interestArea} · {course._count.enrollments} enrollments
                  </span>
                </div>
              ))}
              {coInstructorAssignments.map((assignment: any) => (
                <div key={assignment.id} className="instructor-profile-assignment-row">
                  <strong>{assignment.course.title}</strong>
                  <span>
                    {formatInstructorOpsLabel(assignment.role)} · Co-instructor
                  </span>
                </div>
              ))}
              {courses.length === 0 && coInstructorAssignments.length === 0 ? (
                <p className="instructor-profile-muted">No legacy course assignments found.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="instructor-profile-history">
          <h3>Teaching permissions & certifications</h3>
          <div className="instructor-profile-permission-grid">
            {teachingPermissions.map((permission: any) => (
              <div key={permission.id} className="instructor-profile-mini-row">
                <strong>{formatInstructorOpsLabel(permission.level)}</strong>
                <span>Granted {formatInstructorOpsDate(permission.grantedAt)}</span>
              </div>
            ))}
            {instructorCertifications.map((certification: any) => (
              <div key={certification.id} className="instructor-profile-mini-row">
                <strong>{certification.certType}</strong>
                <span>
                  {formatInstructorOpsLabel(certification.status)}
                  {certification.expiresAt
                    ? ` · Expires ${formatInstructorOpsDate(certification.expiresAt)}`
                    : ""}
                </span>
              </div>
            ))}
            {teachingPermissions.length === 0 && instructorCertifications.length === 0 ? (
              <p className="instructor-profile-muted">
                No permissions or certifications recorded.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="card instructor-profile-section">
        <SectionHeading title="Mentorship" detail="Mentor and mentee relationships." />
        <div className="instructor-profile-two-column">
          <div>
            <h3>As mentee</h3>
            {menteePairs.length === 0 ? (
              <p className="instructor-profile-muted">No instructor mentor assigned.</p>
            ) : (
              <div className="instructor-profile-stack">
                {menteePairs.map((pair: any) => (
                  <div key={pair.id} className="instructor-profile-assignment-row">
                    <strong>{pair.mentor.name}</strong>
                    <span>{pair.mentor.email}</span>
                    <small>
                      {formatInstructorOpsLabel(pair.status)} since{" "}
                      {formatInstructorOpsDate(pair.startDate)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h3>As mentor</h3>
            {mentorPairs.length === 0 ? (
              <p className="instructor-profile-muted">No instructor mentees assigned.</p>
            ) : (
              <div className="instructor-profile-stack">
                {mentorPairs.map((pair: any) => (
                  <div key={pair.id} className="instructor-profile-assignment-row">
                    <strong>{pair.mentee.name}</strong>
                    <span>{pair.mentee.email}</span>
                    <small>
                      {formatInstructorOpsLabel(pair.status)} since{" "}
                      {formatInstructorOpsDate(pair.startDate)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
