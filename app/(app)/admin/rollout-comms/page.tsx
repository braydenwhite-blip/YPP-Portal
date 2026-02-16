import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SendLogItem = {
  id: string;
  title: string;
  createdAt: Date;
  createdByName: string;
  targetRoles: string[];
  chapterName: string | null;
  audience: string;
  status: string;
};

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export default async function RolloutCommsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!session?.user?.id || !roles.includes("ADMIN")) {
    redirect("/");
  }

  const params = await searchParams;
  const sent = Number(params.sent ?? 0);
  const sendError = String(params.error ?? "");
  const flaggedLegacy = String(params.legacy ?? "") === "1";

  const chapters = await prisma.chapter.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let sends: SendLogItem[] = [];
  let legacyMode = false;
  try {
    const campaigns = await prisma.rolloutCampaign.findMany({
      include: {
        createdBy: { select: { name: true } },
        chapter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    sends = campaigns.map((campaign) => ({
      id: campaign.id,
      title: campaign.title,
      createdAt: campaign.createdAt,
      createdByName: campaign.createdBy.name,
      targetRoles: campaign.targetRoles,
      chapterName: campaign.chapter?.name ?? null,
      audience: campaign.audience,
      status: campaign.status,
    }));
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
    legacyMode = true;
    const announcements = await prisma.announcement.findMany({
      where: {
        title: { startsWith: "[Rollout]" },
      },
      include: {
        author: { select: { name: true } },
        chapter: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    sends = announcements.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      createdAt: announcement.createdAt,
      createdByName: announcement.author.name,
      targetRoles: announcement.targetRoles,
      chapterName: announcement.chapter?.name ?? null,
      audience: "LEGACY",
      status: "SENT",
    }));
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Rollout Communications Hub</h1>
          <p className="page-subtitle">Send rollout templates and track communication history.</p>
        </div>
      </div>

      {sent > 0 ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid #16a34a" }}>
          <strong>Message sent.</strong> The rollout announcement has been logged.
        </div>
      ) : null}

      {sendError ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid #b91c1c" }}>
          <strong>Send failed.</strong> Please retry the message.
        </div>
      ) : null}

      {legacyMode || flaggedLegacy ? (
        <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid #f59e0b" }}>
          <strong>Legacy logging mode.</strong> RolloutCampaign storage is not migrated yet, so logs are loaded
          from announcements.
        </div>
      ) : null}

      <div className="grid two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Send Rollout Template</h3>
          <form action="/api/admin/rollout-comms/send" method="POST" style={{ marginTop: 10 }}>
            <div className="grid two" style={{ marginBottom: 10 }}>
              <label className="form-row">
                Template
                <select name="templateKey" className="input" defaultValue="INSTRUCTOR_PILOT">
                  <option value="INSTRUCTOR_PILOT">Instructor Pilot Invite</option>
                  <option value="STUDENT_LAUNCH">Student Launch Invite</option>
                  <option value="PARENT_MIGRATION">Parent Migration Letter</option>
                  <option value="WEBINAR_FOLLOWUP">Webinar Follow-up</option>
                </select>
              </label>
              <label className="form-row">
                Audience
                <select name="audience" className="input" defaultValue="ALL">
                  <option value="ALL">All</option>
                  <option value="INSTRUCTORS">Instructors</option>
                  <option value="STUDENTS">Students</option>
                  <option value="PARENTS">Parents</option>
                </select>
              </label>
            </div>

            <label className="form-row" style={{ marginBottom: 10 }}>
              Portal / Recording Link
              <input name="link" className="input" defaultValue="https://portal.youthpassionproject.org" />
            </label>

            <label className="form-row" style={{ marginBottom: 10 }}>
              Chapter Scope (optional)
              <select name="chapterId" className="input" defaultValue="">
                <option value="">All chapters</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row" style={{ marginBottom: 12 }}>
              Additional Note (optional)
              <textarea
                name="note"
                className="input"
                rows={4}
                placeholder="Any chapter-specific details or next steps."
              />
            </label>

            <button type="submit" className="button primary">
              Send + Log
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Website Handoff Pack</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Use this package for the public-site update.
          </p>
          <div style={{ marginTop: 8, display: "grid", gap: 8, fontSize: 14 }}>
            <div>
              <strong>Primary CTA:</strong> "Check out our new portal"
            </div>
            <div>
              <strong>Main URL:</strong> https://portal.youthpassionproject.org
            </div>
            <div>
              <strong>Student Entry:</strong> /curriculum
            </div>
            <div>
              <strong>Instructor Entry:</strong> /instructor/workspace
            </div>
            <div>
              <strong>Parent Entry:</strong> /parent
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Send Log</h3>
        {sends.length === 0 ? (
          <p className="empty">No rollout sends yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {sends.map((send) => (
              <div key={send.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>{send.title}</strong>
                  <span className="pill">{new Date(send.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>
                  By {send.createdByName} | Audience: {send.audience} | Status: {send.status}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
                  Roles: {send.targetRoles.join(", ")}
                  {send.chapterName ? ` | Chapter: ${send.chapterName}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
