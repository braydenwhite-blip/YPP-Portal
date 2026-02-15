import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getChatChannels } from "@/lib/messaging-actions";

const audienceLabel: Record<string, string> = {
  ALL: "All members",
  STUDENTS: "Students",
  INSTRUCTORS: "Instructors",
  MENTORS: "Mentors",
  LEADERSHIP: "Leadership",
};

export default async function CommunityChatPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const channels = await getChatChannels();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Community Chat</h1>
          <p className="page-subtitle">
            Slack-style channels built on your existing messaging system.
          </p>
        </div>
        <Link href="/messages" className="button small outline" style={{ marginTop: 0 }}>
          Direct Messages
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>How Channel Chat Works</h3>
        <div className="compact-list" style={{ marginTop: 10 }}>
          <div className="compact-list-item align-start">
            <p className="compact-list-title">1. Choose a channel</p>
            <p className="compact-list-meta">Pick a shared room based on role, class, or community topic.</p>
          </div>
          <div className="compact-list-item align-start">
            <p className="compact-list-title">2. Join automatically</p>
            <p className="compact-list-meta">Opening a channel adds you to that conversation thread.</p>
          </div>
          <div className="compact-list-item align-start">
            <p className="compact-list-title">3. Reply in one thread</p>
            <p className="compact-list-meta">Use the same message composer and unread tracking as direct messages.</p>
          </div>
        </div>
      </div>

      {channels.length === 0 ? (
        <div className="card">
          <p className="empty">
            No channels available for your current role yet.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {channels.map((channel) => (
            <Link
              key={channel.slug}
              href={`/messages/${channel.conversationId}`}
              className="card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: 6 }}>
                    <span style={{ marginRight: 8 }}>{channel.emoji}</span>
                    {channel.name}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
                    {channel.description}
                  </p>
                </div>
                {channel.unreadCount > 0 ? (
                  <span className="badge">
                    {channel.unreadCount > 99 ? "99+" : channel.unreadCount} new
                  </span>
                ) : null}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="pill pill-small">{audienceLabel[channel.audience] || channel.audience}</span>
                {channel.source === "class" ? (
                  <span className="pill pill-small pill-pathway">Class Channel</span>
                ) : (
                  <span className="pill pill-small pill-info">Community Channel</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
