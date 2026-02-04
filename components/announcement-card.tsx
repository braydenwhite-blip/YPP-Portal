interface Announcement {
  id: string;
  title: string;
  content: string;
  publishedAt: Date;
  expiresAt: Date | null;
  targetRoles: string[];
  isActive: boolean;
  author: { name: string };
  chapter: { name: string } | null;
}

export default function AnnouncementCard({
  announcement,
  showMeta = false
}: {
  announcement: Announcement;
  showMeta?: boolean;
}) {
  const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < new Date();

  return (
    <div className={`announcement-card ${!announcement.isActive || isExpired ? "inactive" : ""}`}>
      <div className="announcement-header">
        <h3>{announcement.title}</h3>
        <div className="announcement-meta">
          <span className="announcement-date">
            {new Date(announcement.publishedAt).toLocaleDateString()}
          </span>
          {announcement.chapter && (
            <span className="pill">{announcement.chapter.name}</span>
          )}
        </div>
      </div>
      <p className="announcement-content">{announcement.content}</p>
      <div className="announcement-footer">
        <span className="announcement-author">Posted by {announcement.author.name}</span>
        {showMeta && (
          <div className="announcement-tags">
            {announcement.targetRoles.map((role) => (
              <span key={role} className="pill pill-small">
                {role}
              </span>
            ))}
          </div>
        )}
        {isExpired && <span className="pill pill-declined">Expired</span>}
        {!announcement.isActive && <span className="pill pill-declined">Inactive</span>}
      </div>
    </div>
  );
}
