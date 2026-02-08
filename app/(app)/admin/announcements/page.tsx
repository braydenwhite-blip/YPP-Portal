import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoleType } from "@prisma/client";
import {
  createAnnouncement,
  toggleAnnouncementActive,
  deleteAnnouncement
} from "@/lib/announcement-actions";

export default async function AdminAnnouncementsPage() {
  const session = await getServerSession(authOptions);
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const chaptersPromise = prisma.chapter.findMany({ orderBy: { name: "asc" } });

  let announcements: Array<{
    id: string;
    title: string;
    content: string;
    publishedAt: Date;
    scheduledPublishAt: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
    targetRoles: RoleType[];
    author: { name: string };
    chapter: { name: string } | null;
  }> = [];

  try {
    announcements = await prisma.announcement.findMany({
      // Explicit select keeps this page working even if the database
      // hasn't been migrated yet (e.g. scheduledPublishAt missing).
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        scheduledPublishAt: true,
        expiresAt: true,
        isActive: true,
        targetRoles: true,
        author: { select: { name: true } },
        chapter: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" }
    });
  } catch (err: any) {
    const missingScheduledPublishAt =
      err?.code === "P2022" && err?.meta?.column === "Announcement.scheduledPublishAt";
    if (!missingScheduledPublishAt) throw err;

    const fallback = await prisma.announcement.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        expiresAt: true,
        isActive: true,
        targetRoles: true,
        author: { select: { name: true } },
        chapter: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" }
    });

    // If the DB doesn't have scheduledPublishAt yet, treat it as null.
    announcements = fallback.map((a) => ({ ...a, scheduledPublishAt: null }));
  }

  const chapters = await chaptersPromise;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Manage Announcements</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Create Announcement</h3>
          <form action={createAnnouncement} className="form-grid">
            <label className="form-row">
              Title
              <input className="input" name="title" required />
            </label>
            <label className="form-row">
              Content
              <textarea className="input" name="content" rows={4} required />
            </label>
            <label className="form-row">
              Chapter (optional - leave blank for all chapters)
              <select className="input" name="chapterId" defaultValue="">
                <option value="">All Chapters</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Schedule Publish (optional - leave blank to publish now)
              <input className="input" name="scheduledPublishAt" type="datetime-local" />
            </label>
            <label className="form-row">
              Expires At (optional)
              <input className="input" name="expiresAt" type="datetime-local" />
            </label>
            <div className="form-row">
              Target Roles (leave unchecked for all roles)
              <div className="checkbox-grid">
                {Object.values(RoleType).map((role) => (
                  <label
                    key={role}
                    style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}
                  >
                    <input type="checkbox" name="targetRoles" value={role} />
                    {role}
                  </label>
                ))}
              </div>
            </div>
            <button className="button" type="submit">
              Create Announcement
            </button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Announcements</h3>
          {announcements.length === 0 ? (
            <p>No announcements yet.</p>
          ) : (
            <div className="announcements-admin-list">
              {announcements.map((announcement) => {
                const isExpired =
                  announcement.expiresAt && new Date(announcement.expiresAt) < new Date();
                return (
                  <div
                    key={announcement.id}
                    className={`announcement-admin-item ${
                      !announcement.isActive || isExpired ? "inactive" : ""
                    }`}
                  >
                    <div className="announcement-admin-header">
                      <strong>{announcement.title}</strong>
                      <div className="announcement-admin-badges">
                        {announcement.chapter && (
                          <span className="pill pill-small">{announcement.chapter.name}</span>
                        )}
                        {announcement.scheduledPublishAt &&
                          new Date(announcement.scheduledPublishAt) > new Date() && (
                            <span className="pill pill-small">
                              Scheduled: {new Date(announcement.scheduledPublishAt).toLocaleString()}
                            </span>
                          )}
                        {!announcement.isActive && (
                          <span className="pill pill-small pill-declined">Inactive</span>
                        )}
                        {isExpired && (
                          <span className="pill pill-small pill-declined">Expired</span>
                        )}
                      </div>
                    </div>
                    <p className="announcement-admin-content">
                      {announcement.content.length > 150
                        ? announcement.content.substring(0, 150) + "..."
                        : announcement.content}
                    </p>
                    <div className="announcement-admin-meta">
                      <span>
                        By {announcement.author.name} on{" "}
                        {new Date(announcement.publishedAt).toLocaleDateString()}
                      </span>
                      <span>
                        Targets: {announcement.targetRoles.join(", ")}
                      </span>
                    </div>
                    <div className="announcement-admin-actions">
                      <form action={toggleAnnouncementActive} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={announcement.id} />
                        <input
                          type="hidden"
                          name="currentActive"
                          value={String(announcement.isActive)}
                        />
                        <button className="button small" type="submit">
                          {announcement.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteAnnouncement} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={announcement.id} />
                        <button className="button small secondary" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
