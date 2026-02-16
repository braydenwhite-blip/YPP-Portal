import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateChapterPosition } from "@/lib/application-actions";

function toDateInput(value: Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default async function EditChapterPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, position] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        chapterId: true,
        roles: {
          select: { role: true },
        },
      },
    }),
    prisma.position.findUnique({
      where: { id },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  if (!position) {
    notFound();
  }

  if (!user) {
    redirect("/login");
  }

  const roles = user.roles.map((role) => role.role);
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_LEAD");

  if (!isAdmin && !isChapterLead) {
    redirect("/");
  }

  if (!isAdmin && (!user.chapterId || user.chapterId !== position.chapterId)) {
    redirect("/chapter/recruiting");
  }

  const chapters = isAdmin
    ? await prisma.chapter.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const hiringLeads = isAdmin
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
          <h1 className="page-title">Edit Opening</h1>
          <p className="page-subtitle">
            {position.title} {position.chapter ? `· ${position.chapter.name}` : ""}
          </p>
        </div>
        <Link href="/chapter/recruiting" className="button small outline" style={{ textDecoration: "none" }}>
          Back to Recruiting
        </Link>
      </div>

      <div className="card">
        <form action={updateChapterPosition} className="form-grid">
          <input type="hidden" name="positionId" value={position.id} />

          <div className="grid two">
            <label className="form-row">
              Position Title
              <input className="input" name="title" defaultValue={position.title} required />
            </label>
            <label className="form-row">
              Position Type
              <select className="input" name="type" defaultValue={position.type} required>
                <option value="INSTRUCTOR">Instructor</option>
                <option value="MENTOR">Mentor</option>
                <option value="STAFF">Staff</option>
                <option value="CHAPTER_PRESIDENT">Chapter President</option>
                {isAdmin ? <option value="GLOBAL_ADMIN">Global Admin</option> : null}
              </select>
            </label>
          </div>

          {isAdmin ? (
            <div className="grid two">
              <label className="form-row">
                Chapter
                <select className="input" name="chapterId" defaultValue={position.chapterId ?? ""} required>
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
                <select className="input" name="hiringLeadId" defaultValue={position.hiringLeadId ?? ""}>
                  <option value="">No hiring lead selected</option>
                  {hiringLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} {lead.chapter?.name ? `(${lead.chapter.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <input type="hidden" name="chapterId" value={position.chapterId ?? ""} />
          )}

          <label className="form-row">
            Description
            <textarea className="input" name="description" rows={4} defaultValue={position.description ?? ""} />
          </label>

          <label className="form-row">
            Requirements
            <textarea className="input" name="requirements" rows={4} defaultValue={position.requirements ?? ""} />
          </label>

          <div className="grid three">
            <label className="form-row">
              Visibility
              <select className="input" name="visibility" defaultValue={position.visibility}>
                <option value="CHAPTER_ONLY">Chapter Only</option>
                <option value="NETWORK_WIDE">Network Wide</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>
            <label className="form-row">
              Interview Requirement
              <select
                className="input"
                name="interviewRequired"
                defaultValue={position.interviewRequired ? "true" : "false"}
              >
                <option value="true">Interview Required</option>
                <option value="false">Interview Optional</option>
              </select>
            </label>
            <label className="form-row">
              Application Deadline
              <input
                type="date"
                className="input"
                name="applicationDeadline"
                defaultValue={toDateInput(position.applicationDeadline)}
              />
            </label>
          </div>

          <label className="form-row">
            Target Start Date
            <input
              type="date"
              className="input"
              name="targetStartDate"
              defaultValue={toDateInput(position.targetStartDate)}
            />
          </label>

          <button type="submit" className="button">
            Save Opening Changes
          </button>
        </form>
      </div>
    </div>
  );
}
