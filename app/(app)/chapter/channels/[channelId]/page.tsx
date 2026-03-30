import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getChannelMessages } from "@/lib/chapter-channel-actions";
import { ChannelMessageComposer } from "./channel-message-composer";

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

const ROLE_COLORS: Record<string, string> = {
  CHAPTER_PRESIDENT: "#5a1da8",
  ADMIN: "#dc2626",
  INSTRUCTOR: "#0369a1",
  MENTOR: "#ca8a04",
  STUDENT: "#6b7280",
  STAFF: "#059669",
};

export default async function ChannelPage({
  params,
}: {
  params: { channelId: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { channel, messages } = await getChannelMessages(params.channelId);

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link
            href="/chapter/channels"
            style={{ fontSize: 13, color: "var(--muted)", textDecoration: "none" }}
          >
            ← All Channels
          </Link>
          <h1 style={{ margin: "4px 0 0" }}>#{channel.name}</h1>
          {channel.description && (
            <p className="subtitle">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="card"
        style={{
          padding: 0,
          display: "flex",
          flexDirection: "column",
          minHeight: 400,
          maxHeight: "calc(100vh - 280px)",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>
              <p style={{ fontSize: 24 }}>👋</p>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameAuthor = prevMsg?.author.id === msg.author.id;
              const timeDiff = prevMsg
                ? new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()
                : Infinity;
              const grouped = sameAuthor && timeDiff < 5 * 60 * 1000; // Group within 5 mins

              return (
                <div key={msg.id} style={{ marginTop: grouped ? 0 : 12 }}>
                  {!grouped && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: ROLE_COLORS[msg.author.primaryRole] ?? "#6b7280",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {msg.author.name.charAt(0)}
                      </div>
                      <strong style={{ fontSize: 14 }}>{msg.author.name}</strong>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.5,
                      paddingLeft: grouped ? 38 : 38,
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Message Composer */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 20px",
          }}
        >
          <ChannelMessageComposer channelId={params.channelId} />
        </div>
      </div>
    </main>
  );
}
