import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getConversation, sendMessage } from "@/lib/messaging-actions";
import { MessageSubscriber } from "@/components/message-subscriber";

function formatMessageTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentUserId = session.user.id;

  let conversation;
  try {
    conversation = await getConversation(conversationId);
  } catch {
    redirect("/messages");
  }

  const otherParticipants = conversation.participants
    .filter((p) => p.id !== currentUserId)
    .map((p) => p.name)
    .join(", ");

  const displayTitle =
    conversation.subject || otherParticipants || "Conversation";

  return (
    <div className="main-content">
      {/* Real-time message subscription */}
      <MessageSubscriber conversationId={conversationId} userId={currentUserId} />

      {/* Header */}
      <div className="page-header">
        <Link
          href="/messages"
          className="back-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--muted, #6b7280)",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          &larr; Back to Messages
        </Link>
        <h1 className="page-title">{displayTitle}</h1>
        {conversation.subject && (
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted, #6b7280)" }}>
            {otherParticipants}
          </p>
        )}
      </div>

      {/* Messages List */}
      <div style={{ marginBottom: 24 }}>
        {conversation.messages.length === 0 ? (
          <div className="card">
            <p className="empty">
              No messages in this conversation yet. Send one below to get
              started.
            </p>
          </div>
        ) : (
          conversation.messages.map((message) => {
            const isOwn = message.sender.id === currentUserId;

            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: isOwn ? "flex-end" : "flex-start",
                  marginBottom: 12,
                }}
              >
                <div
                  className="card"
                  style={{
                    maxWidth: "70%",
                    borderLeft: isOwn
                      ? "4px solid var(--primary, #6b21a8)"
                      : "4px solid var(--border, #d1d5db)",
                    backgroundColor: isOwn
                      ? "var(--surface-alt, #f9fafb)"
                      : "var(--surface, #fff)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 6,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 13,
                        color: isOwn
                          ? "var(--primary, #6b21a8)"
                          : "var(--foreground, #111827)",
                      }}
                    >
                      {isOwn ? "You" : message.sender.name}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted, #9ca3af)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatMessageTime(message.createdAt)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Form */}
      <div className="card">
        <h3 style={{ margin: "0 0 12px" }}>Reply</h3>
        <form action={sendMessage}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <div className="form-group">
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Type your reply..."
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
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button type="submit" className="btn btn-primary">
              Send Reply
            </button>
            <Link href="/messages" className="btn btn-secondary" style={{ textDecoration: "none" }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
