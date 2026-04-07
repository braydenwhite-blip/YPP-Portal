import { redirect } from "next/navigation";
import {
  CourseFormat,
  EventType,
  MentorshipType,
  TrainingModuleType,
} from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  createCourse,
  createEvent,
  createMentorship,
  createPathway,
  createTrainingModule,
} from "@/lib/admin-actions";
import {
  canAccessContentAdmin,
  normalizeAdminSubtypes,
} from "@/lib/admin-subtypes";
import { CreateUserForm } from "@/components/create-user-form";
import PageHelp from "@/components/page-help";

const CONTENT_TYPE_OPTIONS = [
  { value: "course", label: "Course" },
  { value: "pathway", label: "Pathway" },
  { value: "training", label: "Training Module" },
  { value: "event", label: "Event" },
  { value: "mentorship", label: "Mentorship Pairing" },
  { value: "user", label: "User Account" },
] as const;

type ContentType = (typeof CONTENT_TYPE_OPTIONS)[number]["value"];

function isContentType(value: string | undefined): value is ContentType {
  return CONTENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function formatSubtypeList(subtypes: string[]) {
  return subtypes
    .map((subtype) => subtype.replace(/_/g, " ").toLowerCase())
    .map((label) => label.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const adminSubtypes = normalizeAdminSubtypes(
    ((session?.user as { adminSubtypes?: string[] } | undefined)?.adminSubtypes ?? [])
  );

  if (!roles.includes("ADMIN") || !canAccessContentAdmin(adminSubtypes)) {
    redirect("/");
  }

  const selectedType: ContentType = isContentType(searchParams?.type)
    ? searchParams.type
    : "course";

  const [chapters, users] = await Promise.all([
    prisma.chapter.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ include: { roles: true }, orderBy: { name: "asc" } }),
  ]);

  const instructors = users.filter((user) => user.roles.some((role) => role.role === "INSTRUCTOR"));
  const mentors = users.filter((user) => user.roles.some((role) => role.role === "MENTOR"));
  const students = users.filter((user) => user.roles.some((role) => role.role === "STUDENT"));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <span className="badge">Create Content</span>
          <h1 className="page-title">Create Content</h1>
          <p className="page-subtitle">
            Choose one content type, fill in the matching fields, and submit when it is ready.
          </p>
        </div>
      </div>

      <PageHelp
        purpose="This workspace is for approved content and setup tasks that should be created from the portal."
        firstStep="Pick the content type you need from the dropdown so the page only shows the fields for that one task."
        nextStep="After you submit, the matching portal area is refreshed and the new item becomes available in its workflow."
      />

      <div className="card" style={{ marginTop: 16, marginBottom: 20 }}>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Your admin subtype access: <strong>{formatSubtypeList(adminSubtypes)}</strong>.
        </p>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Trainings and other structured backend content should still be created carefully and only by approved owners.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form method="GET" style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <label className="form-row" style={{ marginBottom: 0, minWidth: 280 }}>
            Content Type
            <select className="input" name="type" defaultValue={selectedType} style={{ marginBottom: 0 }}>
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Open Form
          </button>
        </form>
      </div>

      {selectedType === "course" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create Course</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Use this for approved catalog-ready courses only.
          </p>
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
                    {format.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Learner Fit
              <select className="input" name="learnerFit" defaultValue="">
                <option value="">Flexible / mixed experience</option>
                <option value="LEVEL_101">Best for first-time learners</option>
                <option value="LEVEL_201">Great if you&apos;ve tried the basics</option>
                <option value="LEVEL_301">Best if you&apos;re ready to work more independently</option>
                <option value="LEVEL_401">Best for advanced project work</option>
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
      ) : null}

      {selectedType === "pathway" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create Pathway</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Use pathways as recommended course sequences, not as an onboarding gate.
          </p>
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
      ) : null}

      {selectedType === "training" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create Training Module</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Only use this when the training workflow has already been approved.
          </p>
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
              Material Link
              <input className="input" name="materialUrl" type="url" placeholder="https://..." />
            </label>
            <label className="form-row">
              Material Notes
              <textarea className="input" name="materialNotes" rows={2} />
            </label>
            <label className="form-row">
              Type
              <select className="input" name="type" defaultValue={TrainingModuleType.WORKSHOP}>
                {Object.values(TrainingModuleType).map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
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
              Create Training Module
            </button>
          </form>
        </div>
      ) : null}

      {selectedType === "event" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create Event</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Create the event record only after the timing and ownership are confirmed.
          </p>
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
              <select className="input" name="eventType" defaultValue={EventType.WORKSHOP}>
                {Object.values(EventType).map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Start Date
              <input className="input" name="startDate" type="datetime-local" required />
            </label>
            <label className="form-row">
              End Date
              <input className="input" name="endDate" type="datetime-local" required />
            </label>
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" defaultValue="">
                <option value="">Global event</option>
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
      ) : null}

      {selectedType === "mentorship" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create Mentorship Pairing</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Use this only after mentor ownership and mentee fit have been reviewed.
          </p>
          <form action={createMentorship} className="form-grid">
            <label className="form-row">
              Mentor
              <select className="input" name="mentorId" defaultValue="" required>
                <option value="" disabled>
                  Select a mentor
                </option>
                {mentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Mentee
              <select className="input" name="menteeId" defaultValue="" required>
                <option value="" disabled>
                  Select a mentee
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Mentorship Type
              <select className="input" name="type" defaultValue={MentorshipType.STUDENT}>
                {Object.values(MentorshipType).map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Notes
              <textarea className="input" name="notes" rows={3} />
            </label>
            <button className="button" type="submit">
              Create Mentorship Pairing
            </button>
          </form>
        </div>
      ) : null}

      {selectedType === "user" ? (
        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Create User Account</h2>
          <p style={{ marginTop: 0, color: "var(--muted)" }}>
            Create portal accounts only when they belong to an approved onboarding process.
          </p>
          <CreateUserForm chapters={chapters} />
        </div>
      ) : null}
    </div>
  );
}
