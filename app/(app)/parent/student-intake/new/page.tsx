import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { createStudentIntakeCase } from "@/lib/student-intake-actions";

export default async function ParentStudentIntakeNewPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    redirect("/");
  }

  const chapters = await prisma.chapter.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <Link href="/parent" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Parent Portal
          </Link>
          <h1 className="page-title">Start Student Journey</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Step 1: tell us who the student is, what they care about, and what kind of support would help most.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: "12px 16px",
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-sm)",
          borderLeft: "3px solid var(--ypp-purple)",
          marginBottom: 20,
          fontSize: 13,
          color: "var(--text-secondary)",
        }}
      >
        This creates a draft first. After that, you land on the student journey page where you can review everything and submit it to the chapter team.
      </div>

      <form action={createStudentIntakeCase} className="card" style={{ maxWidth: 860 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Student basics</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              These details help the chapter route the student to the right people and the right first steps.
            </p>
          </div>

          <div className="grid two">
            <label className="form-label">
              Student name
              <input className="input" name="studentName" placeholder="Student full name" required />
            </label>
            <label className="form-label">
              Student email
              <input className="input" name="studentEmail" type="email" placeholder="student@example.com" required />
            </label>
          </div>

          <div className="grid three">
            <label className="form-label">
              Grade
              <input className="input" name="studentGrade" type="number" min={1} max={16} placeholder="e.g. 9" />
            </label>
            <label className="form-label">
              School
              <input className="input" name="studentSchool" placeholder="e.g. Lincoln High School" />
            </label>
            <label className="form-label">
              Relationship
              <select className="input" name="relationship" defaultValue="Parent">
                <option value="Parent">Parent</option>
                <option value="Guardian">Guardian</option>
                <option value="Grandparent">Grandparent</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          <label className="form-label">
            Chapter
            <select className="input" name="chapterId" defaultValue="" required>
              <option value="" disabled>
                Select a chapter
              </option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <h3 style={{ margin: 0 }}>Student profile and goals</h3>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              Put one idea per line when that feels easiest. Short, real answers are better than perfect answers.
            </p>
          </div>

          <label className="form-label">
            Interests
            <textarea
              className="input"
              name="interests"
              rows={4}
              placeholder={"Music production\nCoding\nPublic speaking"}
            />
          </label>

          <label className="form-label">
            Goals
            <textarea
              className="input"
              name="goals"
              rows={4}
              placeholder={"Build confidence speaking in groups\nJoin a class this season\nExplore design or tech"}
            />
          </label>

          <label className="form-label">
            Support needs
            <textarea
              className="input"
              name="supportNeeds"
              rows={4}
              placeholder="Tell the chapter what kind of help, encouragement, structure, or accommodations would make the best start."
            />
          </label>

          <label className="form-label">
            Optional parent notes
            <textarea
              className="input"
              name="parentNotes"
              rows={4}
              placeholder="Anything else the chapter should know before review."
            />
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="button">
              Save Draft
            </button>
            <Link href="/parent" className="button secondary">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
