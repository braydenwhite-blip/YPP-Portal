import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getParentConversations } from "@/lib/parent-message-actions";

export default async function ParentMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) redirect("/");

  const conversations = await getParentConversations();

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <Link href="/parent" style={{ fontSize: 13, color: "var(--muted)" }}>
            &larr; Parent Portal
          </Link>
          <h1 className="page-title">Messages</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Conversations with your child&apos;s instructors
          </p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✉</div>
          <h3 style={{ margin: "0 0 8px" }}>No conversations yet</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>
            Go to a student&apos;s detail page and click &ldquo;Message Instructor&rdquo; to start a thread.
          </p>
          <Link href="/parent" className="button">
            View Students
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conversations.map((conv) => {
            const otherParticipants = conv.participants.filter(
              (p) => p.id !== session.user.id
            );
            const lastMsg = conv.lastMessage;
            return (
              <Link
                key={conv.conversationId}
                href={`/parent/messages/${conv.conversationId}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="card"
                  style={{
                    padding: "14px 16px",
                    cursor: "pointer",
                    borderLeft: conv.hasUnread
                      ? "4px solid var(--ypp-purple)"
                      : "4px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        {conv.hasUnread && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "var(--ypp-purple)",
                              flexShrink: 0,
                              display: "inline-block",
                            }}
                          />
                        )}
                        <strong
                          style={{
                            fontSize: 14,
                            color: "var(--foreground)",
                            fontWeight: conv.hasUnread ? 700 : 600,
                          }}
                        >
                          {conv.subject}
                        </strong>
                      </div>
                      {otherParticipants.length > 0 && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                          With: {otherParticipants.map((p) => p.name).join(", ")}
                        </div>
                      )}
                      {lastMsg && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{lastMsg.sender.name}:</span>{" "}
                          {lastMsg.content}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {new Date(conv.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
