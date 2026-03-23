import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getChapterChannels } from "@/lib/chapter-channel-actions";
import { CreateChannelForm } from "./create-channel-form";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default async function ChapterChannelsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const isLead = session.user.roles?.some(
    (r: string) => r === "CHAPTER_LEAD" || r === "ADMIN"
  );

  const channels = await getChapterChannels();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Channels</h1>
          <p className="subtitle">Discussion spaces for your chapter community</p>
        </div>
        <Link href="/my-chapter" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Chapter Home
        </Link>
      </div>

      {isLead && <CreateChannelForm />}

      {channels.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>💬</p>
          <h3>No channels yet</h3>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            {isLead
              ? "Create your first channel to get conversations started."
              : "Your chapter lead hasn't created any channels yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {channels.map((channel) => {
            const lastMessage = channel.messages[0];
            return (
              <Link
                key={channel.id}
                href={`/chapter/channels/${channel.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="card"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    transition: "background 0.1s",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>#</span>
                      <strong style={{ fontSize: 15 }}>{channel.name}</strong>
                      {channel.isDefault && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "var(--ypp-purple)",
                            color: "white",
                            fontWeight: 600,
                          }}
                        >
                          DEFAULT
                        </span>
                      )}
                    </div>
                    {channel.description && (
                      <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
                        {channel.description}
                      </p>
                    )}
                    {lastMessage && (
                      <p
                        style={{
                          color: "var(--muted)",
                          fontSize: 12,
                          margin: "6px 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <strong>{lastMessage.author.name}:</strong>{" "}
                        {lastMessage.content.slice(0, 80)}
                        {lastMessage.content.length > 80 ? "..." : ""}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {channel._count.messages}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>messages</div>
                    {lastMessage && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {timeAgo(lastMessage.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
