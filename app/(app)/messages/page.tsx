import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getConversations,
  startConversation,
  getMessageableUsers,
} from "@/lib/messaging-actions";

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [conversations, messageableUsers] = await Promise.all([
    getConversations(),
    getMessageableUsers(),
  ]);

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
        </div>
      </div>

      {/* New Conversation Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px" }}>New Conversation</h3>
        {messageableUsers.length === 0 ? (
          <p className="empty">
            There are no users available to message at this time.
          </p>
        ) : (
          <form action={startConversation}>
            <div className="form-group">
              <label htmlFor="recipientId" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}>
                Recipient
              </label>
              <select
                id="recipientId"
                name="recipientId"
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm, 6px)",
                  border: "1px solid var(--border, #d1d5db)",
                  fontSize: 14,
                  backgroundColor: "var(--surface, #fff)",
                }}
              >
                <option value="">Select a recipient...</option>
                {messageableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.primaryRole.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label htmlFor="subject" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}>
                Subject (optional)
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                placeholder="Enter a subject..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm, 6px)",
                  border: "1px solid var(--border, #d1d5db)",
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label htmlFor="message" style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}>
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={3}
                placeholder="Write your message..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm, 6px)",
                  border: "1px solid var(--border, #d1d5db)",
                  fontSize: 14,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-primary">
                Send Message
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Conversations List */}
      <h3 style={{ margin: "0 0 16px" }}>Conversations</h3>

      {conversations.length === 0 ? (
        <div className="card">
          <p className="empty">
            You have no conversations yet. Start a new conversation above to
            begin messaging.
          </p>
        </div>
      ) : (
        <div>
          {conversations.map((conversation) => {
            const otherParticipants = conversation.participants
              .filter((p) => p.id !== session.user.id)
              .map((p) => p.name)
              .join(", ");

            const displayTitle =
              conversation.subject || otherParticipants || "Conversation";

            return (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="card"
                  style={{
                    marginBottom: 12,
                    cursor: "pointer",
                    borderLeft:
                      conversation.unreadCount > 0
                        ? "4px solid var(--primary, #6b21a8)"
                        : "4px solid transparent",
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
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{
                            fontWeight: conversation.unreadCount > 0 ? 700 : 500,
                          }}
                        >
                          {displayTitle}
                        </strong>
                        {conversation.unreadCount > 0 && (
                          <span className="badge">
                            {conversation.unreadCount} new
                          </span>
                        )}
                        {conversation.isGroup && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--muted, #6b7280)",
                              fontWeight: 500,
                            }}
                          >
                            Group
                          </span>
                        )}
                      </div>

                      {/* Show participant names below title when subject is used */}
                      {conversation.subject && (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "var(--muted, #6b7280)",
                          }}
                        >
                          {otherParticipants}
                        </p>
                      )}

                      {conversation.lastMessage ? (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 14,
                            color: "var(--muted, #6b7280)",
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {conversation.lastMessage.senderName}:
                          </span>{" "}
                          {truncate(conversation.lastMessage.content, 120)}
                        </p>
                      ) : (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 14,
                            color: "var(--muted, #9ca3af)",
                            fontStyle: "italic",
                          }}
                        >
                          No messages yet
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--muted, #9ca3af)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatTimestamp(conversation.updatedAt)}
                      </span>
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
