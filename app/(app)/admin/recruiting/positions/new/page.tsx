import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChapterPosition } from "@/lib/application-actions";

export default async function NewAdminRecruitingPositionPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const [chapters, hiringLeads] = await Promise.all([
    prisma.chapter.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              in: ["ADMIN", "CHAPTER_LEAD", "STAFF"],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        chapter: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin Recruiting</p>
          <h1 className="page-title">Create Opening</h1>
          <p className="page-subtitle">Create a chapter hiring position (including Chapter President roles).</p>
        </div>
        <Link href="/admin/recruiting" className="button small outline" style={{ textDecoration: "none" }}>
          Back to Recruiting
        </Link>
      </div>

      <div className="card">
        <form action={createChapterPosition} className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Position Title
              <input className="input" name="title" placeholder="Chapter President - Spring 2026" required />
            </label>
            <label className="form-row">
              Position Type
              <select className="input" name="type" defaultValue="CHAPTER_PRESIDENT" required>
                <option value="CHAPTER_PRESIDENT">Chapter President</option>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MENTOR">Mentor</option>
                <option value="STAFF">Staff</option>
              </select>
            </label>
          </div>

          <div className="grid two">
            <label className="form-row">
              Chapter
              <select className="input" name="chapterId" required defaultValue="">
                <option value="" disabled>
                  Select chapter
                </option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Hiring Lead
              <select className="input" name="hiringLeadId" defaultValue={session.user.id}>
                {hiringLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} {lead.chapter?.name ? `(${lead.chapter.name})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-row">
            Description
            <textarea
              className="input"
              name="description"
              rows={4}
              placeholder="What this role owns, expected outcomes, and leadership scope..."
            />
          </label>

          <label className="form-row">
            Requirements
            <textarea
              className="input"
              name="requirements"
              rows={4}
              placeholder="Commitment expectations, experience level, and must-have capabilities..."
            />
          </label>

          <div className="grid three">
            <label className="form-row">
              Visibility
              <select className="input" name="visibility" defaultValue="PUBLIC">
                <option value="CHAPTER_ONLY">Chapter Only</option>
                <option value="NETWORK_WIDE">Network Wide</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>
            <label className="form-row">
              Interview Requirement
              <select className="input" name="interviewRequired" defaultValue="true">
                <option value="true">Interview Required</option>
                <option value="false">Interview Optional</option>
              </select>
            </label>
            <label className="form-row">
              Application Deadline
              <input type="date" className="input" name="applicationDeadline" />
            </label>
          </div>

          <label className="form-row">
            Target Start Date
            <input type="date" className="input" name="targetStartDate" />
          </label>

          <button type="submit" className="button">
            Publish Opening
          </button>
        </form>
      </div>
    </div>
  );
}
