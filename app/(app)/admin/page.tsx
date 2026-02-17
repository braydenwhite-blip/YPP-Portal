import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addPathwayStep,
  createCourse,
  createEvent,
  createMentorship,
  createPathway,
  createTrainingModule,
  createUser,
  updateEnrollmentStatus
} from "@/lib/admin-actions";
import {
  CourseFormat,
  CourseLevel,
  EventType,
  MentorshipType,
  RoleType,
  TrainingModuleType
} from "@prisma/client";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [chapters, users, pathways, courses, trainingModules] = await Promise.all([
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ include: { roles: true }, orderBy: { name: "asc" } }),
    prisma.pathway.findMany({ orderBy: { name: "asc" } }),
    prisma.course.findMany({ orderBy: { title: "asc" } }),
    prisma.trainingModule.findMany({ orderBy: { sortOrder: "asc" } })
  ]);

  const instructors = users.filter((user) => user.roles.some((role) => role.role === "INSTRUCTOR"));
  const mentors = users.filter((user) => user.roles.some((role) => role.role === "MENTOR"));
  const instructorMentees = users.filter((user) => user.roles.some((role) => role.role === "INSTRUCTOR"));
  const studentMentees = users.filter((user) => user.roles.some((role) => role.role === "STUDENT"));

  const pendingEnrollments = await prisma.enrollment.findMany({
    where: { status: "PENDING" },
    include: { user: true, course: true },
    orderBy: { createdAt: "asc" }
  });

  const [pendingIncubatorApps, draftChallenges] = await Promise.all([
    prisma.incubatorApplication.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }).catch(() => 0),
    prisma.challenge.count({
      where: { status: "DRAFT" },
    }).catch(() => 0),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin Control</p>
          <h1 className="page-title">Portal Admin Dashboard</h1>
        </div>
      </div>

      <div className="grid three">
        <div className="card">
          <div className="kpi">{users.length}</div>
          <div className="kpi-label">Users</div>
        </div>
        <div className="card">
          <div className="kpi">{courses.length}</div>
          <div className="kpi-label">Courses</div>
        </div>
        <div className="card">
          <div className="kpi">{pathways.length}</div>
          <div className="kpi-label">Pathways</div>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Challenge Publishing</h3>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{draftChallenges}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            Draft challenge(s) waiting scheduling/publish decisions.
          </div>
          <Link href="/admin/challenges" className="button secondary small" style={{ textDecoration: "none" }}>
            Open Challenge Manager
          </Link>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Incubator Review Queue</h3>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#3b82f6" }}>{pendingIncubatorApps}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            Application(s) waiting review decisions.
          </div>
          <Link href="/admin/incubator" className="button secondary small" style={{ textDecoration: "none" }}>
            Open Incubator Manager
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Recruiting Operations</h3>
        <p style={{ marginTop: 0, color: "var(--muted)" }}>
          Create chapter openings (including Chapter President roles) and manage interview pipelines.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/recruiting" className="button small" style={{ textDecoration: "none" }}>
            Open Recruiting Center
          </Link>
          <Link href="/admin/recruiting/positions/new" className="button small outline" style={{ textDecoration: "none" }}>
            + New Opening
          </Link>
          <Link
            href="/admin/applications?type=CHAPTER_PRESIDENT&chapterProposal=true"
            className="button small outline"
            style={{ textDecoration: "none" }}
          >
            Review Chapter Proposals
          </Link>
          <Link href="/positions?type=CHAPTER_PRESIDENT&status=open" className="button small ghost" style={{ textDecoration: "none" }}>
            Chapter President Openings
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Create User</h3>
          <form action={createUser} className="form-grid">
            <label className="form-row">
              Name
              <input className="input" name="name" required />
            </label>
            <label className="form-row">
              Email
              <input className="input" name="email" type="email" required />
            </label>
            <label className="form-row">
              Phone
              <input className="input" name="phone" />
            </label>
            <label className="form-row">
              Password
              <input className="input" name="password" type="password" required />
            </label>
            <label className="form-row">
              Primary Role
              <select className="input" name="primaryRole" defaultValue={RoleType.STUDENT}>
                {Object.values(RoleType).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">No chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              Additional Roles
              <div className="checkbox-grid">
                {Object.values(RoleType).map((role) => (
                  <label key={role} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" name="roles" value={role} />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <button className="button" type="submit">
              Create User
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Create Course</h3>
          <form action={createCourse} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} required />
            </label>
            <label className="form-row">
              Format
              <select className="input" name="format" defaultValue={CourseFormat.ONE_OFF}>
                {Object.values(CourseFormat).map((format) => (
                  <option key={format} value={format}>
                    {format.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Level (only for 101/201/301)
              <select className="input" name="level" defaultValue="">
                <option value="">Not leveled</option>
                {Object.values(CourseLevel).map((level) => (
                  <option key={level} value={level}>
                    {level.replace("LEVEL_", "")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Interest Area
              <input className="input" name="interestArea" required />
            </label>
            <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="isVirtual" />
              Virtual option
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">No chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Lead Instructor
              <select className="input" name="leadInstructorId" defaultValue="">
                <option value="">Unassigned</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Create Course
            </button>
          </form>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Create Pathway</h3>
          <form action={createPathway} className="form-grid">
            <label className="form-row">
              Name
              <input className="input" name="name" required />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} required />
            </label>
            <label className="form-row">
              Interest Area
              <input className="input" name="interestArea" required />
            </label>
            <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="isActive" defaultChecked />
              Active
            </label>
            <button className="button" type="submit">
              Create Pathway
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Add Pathway Step</h3>
          <form action={addPathwayStep} className="form-grid">
            <label className="form-row">
              Pathway
              <select className="input" name="pathwayId" required>
                {pathways.map((pathway) => (
                  <option key={pathway.id} value={pathway.id}>
                    {pathway.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Course
              <select className="input" name="courseId" required>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Step Order
              <input className="input" name="stepOrder" type="number" min={1} required />
            </label>
            <button className="button" type="submit">
              Add Step
            </button>
          </form>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Create Training Module</h3>
          <form action={createTrainingModule} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} required />
            </label>
            <label className="form-row">
              Material Link (optional)
              <input className="input" name="materialUrl" type="url" placeholder="https://..." />
            </label>
            <label className="form-row">
              Material Notes (optional)
              <textarea className="input" name="materialNotes" rows={2} />
            </label>
            <label className="form-row">
              Type
              <select className="input" name="type" defaultValue={TrainingModuleType.WORKSHOP}>
                {Object.values(TrainingModuleType).map((type) => (
                  <option key={type} value={type}>
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Sort Order
              <input className="input" name="sortOrder" type="number" min={1} defaultValue={1} required />
            </label>
            <label className="form-row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="required" defaultChecked />
              Required
            </label>
            <button className="button" type="submit">
              Create Module
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Create Event</h3>
          <form action={createEvent} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Description
              <textarea className="input" name="description" rows={3} required />
            </label>
            <label className="form-row">
              Event Type
              <select className="input" name="eventType" defaultValue={EventType.FESTIVAL}>
                {Object.values(EventType).map((event) => (
                  <option key={event} value={event}>
                    {event.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Start
              <input className="input" name="startDate" type="datetime-local" required />
            </label>
            <label className="form-row">
              End
              <input className="input" name="endDate" type="datetime-local" required />
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">No chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              Create Event
            </button>
          </form>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Assign Instructor Mentor</h3>
          <form action={createMentorship} className="form-grid">
            <input type="hidden" name="type" value={MentorshipType.INSTRUCTOR} />
            <label className="form-row">
              Mentor
              <select className="input" name="mentorId" required>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Instructor (Mentee)
              <select className="input" name="menteeId" required>
                {instructorMentees.map((mentee) => (
                  <option key={mentee.id} value={mentee.id}>
                    {mentee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Notes
              <textarea className="input" name="notes" rows={3} />
            </label>
            <button className="button" type="submit">
              Assign Instructor Mentor
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Assign Student Mentor</h3>
          <form action={createMentorship} className="form-grid">
            <input type="hidden" name="type" value={MentorshipType.STUDENT} />
            <label className="form-row">
              Mentor
              <select className="input" name="mentorId" required>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Student (Mentee)
              <select className="input" name="menteeId" required>
                {studentMentees.map((mentee) => (
                  <option key={mentee.id} value={mentee.id}>
                    {mentee.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Notes
              <textarea className="input" name="notes" rows={3} />
            </label>
            <button className="button" type="submit">
              Assign Student Mentor
            </button>
          </form>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 24 }}>
        <div className="card">
          <h3>Enrollment Requests</h3>
          {pendingEnrollments.length === 0 ? (
            <p>No pending enrollment requests.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Requested</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingEnrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>{enrollment.user.name}</td>
                    <td>{enrollment.course.title}</td>
                    <td>{new Date(enrollment.createdAt).toLocaleDateString()}</td>
                    <td>
                      <form action={updateEnrollmentStatus} style={{ display: "inline-flex", gap: 8 }}>
                        <input type="hidden" name="enrollmentId" value={enrollment.id} />
                        <button className="button small" type="submit" name="status" value="ENROLLED">
                          Approve
                        </button>
                        <button className="button small secondary" type="submit" name="status" value="DECLINED">
                          Decline
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Existing Training Modules</h3>
          {trainingModules.length === 0 ? (
            <p>No training modules yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Material</th>
                </tr>
              </thead>
              <tbody>
                {trainingModules.map((module) => (
                  <tr key={module.id}>
                    <td>{module.title}</td>
                    <td>{module.type.replace("_", " ")}</td>
                    <td>{module.required ? "Yes" : "No"}</td>
                    <td>
                      {module.materialUrl ? (
                        <a className="link" href={module.materialUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
