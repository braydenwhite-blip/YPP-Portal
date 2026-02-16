import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChapterPosition } from "@/lib/application-actions";

export default async function NewChapterPositionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      chapter: {
        select: {
          id: true,
          name: true,
        },
      },
      roles: {
        select: { role: true },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((role) => role.role);
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    redirect("/");
  }

  if (isChapterLead && !user.chapterId) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">Chapter Recruiting</p>
            <h1 className="page-title">New Opening</h1>
          </div>
          <Link href="/chapter/recruiting" className="button small outline" style={{ textDecoration: "none" }}>
            Back to Recruiting
          </Link>
        </div>
        <div className="card">
          <p className="empty">Your account needs a chapter assignment before you can post positions.</p>
        </div>
      </div>
    );
  }

  const chapters = isAdmin
    ? await prisma.chapter.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const chapterLeads = isAdmin
    ? await prisma.user.findMany({
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
          chapter: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Recruiting</p>
          <h1 className="page-title">Create Chapter Opening</h1>
          <p className="page-subtitle">
            Post a chapter-owned position with interview and deadline settings.
          </p>
        </div>
        <Link href="/chapter/recruiting" className="button small outline" style={{ textDecoration: "none" }}>
          Back to Recruiting
        </Link>
      </div>

      <div className="card">
        <form action={createChapterPosition} className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Position Title
              <input className="input" name="title" placeholder="Lead Robotics Instructor" required />
            </label>
            <label className="form-row">
              Position Type
              <select className="input" name="type" defaultValue="INSTRUCTOR" required>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MENTOR">Mentor</option>
                <option value="STAFF">Staff</option>
                <option value="CHAPTER_PRESIDENT">Chapter President</option>
                {isAdmin ? <option value="GLOBAL_ADMIN">Global Admin (Admin only)</option> : null}
              </select>
            </label>
          </div>

          {isAdmin ? (
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
                <select className="input" name="hiringLeadId" defaultValue={user.id}>
                  {chapterLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} {lead.chapter?.name ? `(${lead.chapter.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <input type="hidden" name="chapterId" value={user.chapterId ?? ""} />
          )}

          <label className="form-row">
            Description
            <textarea
              className="input"
              name="description"
              rows={4}
              placeholder="What this role owns and why it matters for the chapter..."
            />
          </label>

          <label className="form-row">
            Requirements
            <textarea
              className="input"
              name="requirements"
              rows={4}
              placeholder="Experience, availability, and role expectations..."
            />
          </label>

          <div className="grid three">
            <label className="form-row">
              Visibility
              <select className="input" name="visibility" defaultValue="CHAPTER_ONLY">
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
