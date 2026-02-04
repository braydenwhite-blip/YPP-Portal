import Link from "next/link";

interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedAt: Date;
  author: { name: string };
}

export default function AnnouncementBanner({
  announcements
}: {
  announcements: Announcement[];
}) {
  if (announcements.length === 0) return null;

  const latest = announcements[0];

  return (
    <div className="announcement-banner">
      <div className="announcement-banner-content">
        <span className="announcement-badge">New</span>
        <strong>{latest.title}</strong>
        <span className="announcement-preview">
          {latest.content.length > 100
            ? latest.content.substring(0, 100) + "..."
            : latest.content}
        </span>
      </div>
      <Link href="/announcements" className="announcement-link">
        View all ({announcements.length})
      </Link>
    </div>
  );
}
