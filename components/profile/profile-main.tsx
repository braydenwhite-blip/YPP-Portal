import Link from "next/link";
import { updateProfile, updateBasicInfo } from "@/lib/profile-actions";
import FileUpload from "@/components/file-upload";
import {
  STUDENT_GRADE_OPTIONS,
  STUDENT_INTEREST_OPTIONS,
  STUDENT_LEARNING_STYLE_OPTIONS,
  STUDENT_PRIMARY_GOAL_OPTIONS,
} from "@/lib/student-profile";
import type { ProfilePageUser } from "@/lib/profile-page-data";

export default function ProfileMain({
  user,
  layoutVariant = "default",
}: {
  user: ProfilePageUser;
  /** Refined spacing when embedded on Profile & Settings. */
  layoutVariant?: "default" | "settings";
}) {
  const roles = user.roles.map((r) => r.role);
  const isInstructor = roles.includes("INSTRUCTOR");
  const isStudent = roles.includes("STUDENT");

  const interestAreas = Array.from(
    new Set([
      ...STUDENT_INTEREST_OPTIONS.map((option) => option.value),
      ...(user.profile?.interests ?? []),
    ]),
  );

  return (
    <div id="profile" data-profile-layout={layoutVariant === "settings" ? "settings" : undefined}>
      <div className="grid two">
        <div className="card">
          <div className="section-title">Basic Information</div>
          <form action={updateBasicInfo} className="form-grid">
            <div className="form-row">
              <label>Full Name *</label>
              <input type="text" name="name" className="input" defaultValue={user.name} required />
            </div>
            <div className="form-row">
              <label>Email</label>
              <input
                type="email"
                className="input"
                value={user.email}
                disabled
                style={{ background: "var(--surface-alt)" }}
              />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Contact admin to change email</span>
            </div>
            <div className="form-row">
              <label>Phone</label>
              <input
                type="tel"
                name="phone"
                className="input"
                defaultValue={user.phone || ""}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="form-row">
              <label>Chapter</label>
              <input
                type="text"
                className="input"
                value={user.chapter?.name || "No chapter assigned"}
                disabled
                style={{ background: "var(--surface-alt)" }}
              />
            </div>
            <button type="submit" className="button">
              Save Basic Info
            </button>
          </form>
        </div>

        <div className="card">
          <div className="section-title">Extended Profile</div>
          <form action={updateProfile} className="form-grid">
            <div className="form-row">
              <label>Bio</label>
              <textarea
                name="bio"
                className="input"
                rows={3}
                defaultValue={user.profile?.bio || ""}
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="form-row">
              <label>Profile Photo</label>
              <FileUpload
                category="PROFILE_PHOTO"
                label="Upload Photo"
                compact={false}
                currentFileUrl={user.profile?.avatarUrl}
                maxSizeMB={5}
              />
              <input type="hidden" name="avatarUrl" defaultValue={user.profile?.avatarUrl || ""} />
            </div>

            {isInstructor && (
              <div className="form-row">
                <label>Curriculum Link</label>
                <input
                  type="url"
                  name="curriculumUrl"
                  className="input"
                  defaultValue={user.profile?.curriculumUrl || ""}
                  placeholder="https://docs.google.com/..."
                />
              </div>
            )}

            {isStudent && (
              <>
                <div className="form-row">
                  <label>Grade Level</label>
                  <select name="grade" className="input" defaultValue={user.profile?.grade || ""}>
                    <option value="">Select grade...</option>
                    {STUDENT_GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>School</label>
                  <input
                    type="text"
                    name="school"
                    className="input"
                    defaultValue={user.profile?.school || ""}
                    placeholder="Your school name"
                  />
                </div>
                <div className="form-row">
                  <label>How you learn best</label>
                  <select name="learningStyle" className="input" defaultValue={user.profile?.learningStyle || ""}>
                    <option value="">Select one...</option>
                    {STUDENT_LEARNING_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Main goal right now</label>
                  <select name="primaryGoal" className="input" defaultValue={user.profile?.primaryGoal || ""}>
                    <option value="">Select one...</option>
                    {STUDENT_PRIMARY_GOAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <label>Parent/Guardian Email</label>
                  <input
                    type="email"
                    name="parentEmail"
                    className="input"
                    defaultValue={user.profile?.parentEmail || ""}
                    placeholder="parent@email.com"
                  />
                </div>
                <div className="form-row">
                  <label>Parent/Guardian Phone</label>
                  <input
                    type="tel"
                    name="parentPhone"
                    className="input"
                    defaultValue={user.profile?.parentPhone || ""}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </>
            )}

            <div className="form-row">
              <label>Interests</label>
              <div className="checkbox-grid">
                {interestAreas.map((area) => (
                  <label key={area} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      name="interests"
                      value={area}
                      defaultChecked={user.profile?.interests?.includes(area) ?? false}
                    />
                    {area}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="button">
              Save Profile
            </button>
          </form>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        {user.certificates.length > 0 && (
          <div className="card">
            <div className="section-title">Recent Certificates</div>
            <div className="timeline">
              {user.certificates.map((cert) => (
                <div key={cert.id} className="timeline-item">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{cert.title}</strong>
                    <Link href={`/certificates/${cert.id}`} className="link" style={{ fontSize: 12 }}>
                      View
                    </Link>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                    {cert.template.name} · {new Date(cert.issuedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
            <Link href="/certificates" className="link" style={{ display: "block", marginTop: 12, fontSize: 13 }}>
              View all certificates &rarr;
            </Link>
          </div>
        )}

        {user.awards.length > 0 && (
          <div className="card">
            <div className="section-title">Awards</div>
            <div className="timeline">
              {user.awards.map((award) => (
                <div key={award.id} className="timeline-item">
                  <strong>{award.name}</strong>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>{award.description}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    {new Date(award.awardedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {isStudent && user.enrollments.length > 0 && (
          <div className="card">
            <div className="section-title">Recent Enrollments</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {user.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.course.title}</td>
                    <td>
                      <span className={`pill ${enrollment.status === "ENROLLED" ? "pill-success" : ""}`}>
                        {enrollment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isInstructor && user.courses.length > 0 && (
          <div className="card">
            <div className="section-title">My Courses</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Format</th>
                </tr>
              </thead>
              <tbody>
                {user.courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.title}</td>
                    <td>
                      <span className="pill">
                        {course.format === "LEVELED" && course.level
                          ? course.level.replace("LEVEL_", "")
                          : course.format.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
