import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AnnouncementCard from "@/components/announcement-card";

export default async function AnnouncementsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const userRoles = session?.user?.roles ?? [];

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { chapterId: true }
      })
    : null;

  const now = new Date();

  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } }
      ],
      AND: [
        {
          OR: [
            { chapterId: null },
            { chapterId: user?.chapterId ?? undefined }
          ]
        },
        {
          OR: userRoles.length > 0
            ? userRoles.map((role) => ({
                targetRoles: { has: role as any }
              }))
            : [{ targetRoles: { isEmpty: false } }]
        }
      ]
    },
    // Explicit select keeps this page working even if the database
    // hasn't been migrated yet (e.g. scheduledPublishAt missing).
    select: {
      id: true,
      title: true,
      content: true,
      publishedAt: true,
      expiresAt: true,
      targetRoles: true,
      isActive: true,
      author: { select: { name: true } },
      chapter: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Communications</p>
          <h1 className="page-title">Announcements</h1>
        </div>
      </div>

      <div className="announcements-list">
        {announcements.length === 0 ? (
          <div className="card">
            <p>No announcements at this time.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
            />
          ))
        )}
      </div>
    </div>
  );
}
