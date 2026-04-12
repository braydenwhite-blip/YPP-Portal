import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getConversations,
  getMessageableUsers,
  startConversation,
} from "@/lib/messaging-actions";
import {
  isParentConversation,
  matchesMessageCenterTab,
  normalizeMessageCenterTab,
} from "@/lib/message-center";

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

function tabHref(tab: "all" | "direct" | "parent") {
  return tab === "all" ? "/messages" : `/messages?tab=${tab}`;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; to?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  const isParentOnly = roles.includes("PARENT") && roles.every((role) => role === "PARENT");
  const activeTab = normalizeMessageCenterTab(params?.tab);
  const selectedRecipientId = params?.to ?? "";

  const [allConversations, messageableUsers] = await Promise.all([
    getConversations(),
    isParentOnly ? Promise.resolve([]) : getMessageableUsers(),
  ]);

  const visibleConversations = allConversations.filter((conversation) =>
    matchesMessageCenterTab(conversation.contextType, activeTab)
  );

  const tabCounts = {
    all: allConversations.length,
    direct: allConversations.filter(
      (conversation) => !isParentConversation(conversation.contextType)
    ).length,
    parent: allConversations.filter((conversation) =>
      isParentConversation(conversation.contextType)
    ).length,
  };

  return (
    <div className="main-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>
            Direct and parent conversations now live in one shared inbox, and urgent message work can surface back on home next actions.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 24,
          marginTop: 16,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {([
          { key: "all", label: "All" },
          { key: "direct", label: "Direct" },
          { key: "parent", label: "Parent" },
        ] as const).map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              style={{
                textDecoration: "none",
                color: "inherit",
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid var(--border, #d1d5db)",
                background: isActive ? "var(--surface-alt, #f3f4f6)" : "transparent",
                fontWeight: isActive ? 700 : 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{tab.label}</span>
              <span className="badge">{count}</span>
            </Link>
          );
        })}
      </div>

      {isParentOnly ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 8px" }}>Start a parent thread</h3>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
            Open a student detail page and choose <strong>Message Instructor</strong>. That keeps
            each parent conversation tied to the right student.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px" }}>Start a Direct Conversation</h3>
          {messageableUsers.length === 0 ? (
            <p className="empty">
              There are no users available to message at this time.
            </p>
          ) : (
            <form action={startConversation}>
              <div className="form-group">
                <label
                  htmlFor="recipientId"
                  style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}
                >
                  Recipient
                </label>
                <select
                  id="recipientId"
                  name="recipientId"
                  required
                  defaultValue={selectedRecipientId}
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
                <label
                  htmlFor="subject"
                  style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}
                >
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
                <label
                  htmlFor="message"
                  style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}
                >
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

              <div className="form-group" style={{ marginTop: 12 }}>
                <label
                  htmlFor="priority"
                  style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, display: "block" }}
                >
                  Notification Urgency
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="HIGH"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm, 6px)",
                    border: "1px solid var(--border, #d1d5db)",
                    fontSize: 14,
                    backgroundColor: "var(--surface, #fff)",
                  }}
                >
                  <option value="HIGH">P1 High: email + portal for a new thread</option>
                  <option value="URGENT">P0 Critical: text + email + portal</option>
                  <option value="NORMAL">P2 Normal: email + portal</option>
                  <option value="LOW">P3 Low: portal only</option>
                </select>
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 12 }}>
                  Use the higher settings only when the recipient truly needs a faster alert.
                </p>
              </div>

              <div style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn-primary">
                  Send Message
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <h3 style={{ margin: "0 0 16px" }}>
        {activeTab === "all"
          ? "All Conversations"
          : activeTab === "parent"
            ? "Parent Conversations"
            : "Direct Conversations"}
      </h3>

      {visibleConversations.length === 0 ? (
        <div className="card">
          <p className="empty">
            {activeTab === "parent"
              ? "No parent conversations yet."
              : activeTab === "direct"
                ? "No direct conversations yet."
                : "You have no conversations yet."}
          </p>
        </div>
      ) : (
        <div>
          {visibleConversations.map((conversation) => {
            const otherParticipants = conversation.participants
              .filter((participant) => participant.id !== session.user.id)
              .map((participant) => participant.name)
              .join(", ");

            const displayTitle = conversation.subject || otherParticipants || "Conversation";
            const isParentThread = isParentConversation(conversation.contextType);

            return (
              <Link
                key={conversation.id}
                href={
                  isParentThread
                    ? `/messages/${conversation.id}?tab=parent`
                    : `/messages/${conversation.id}`
                }
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
                        {conversation.unreadCount > 0 ? (
                          <span className="badge">{conversation.unreadCount} new</span>
                        ) : null}
                        {isParentThread ? <span className="badge">Parent</span> : null}
                        {conversation.contextType === "INTERVIEW" ? (
                          <span className="badge">Interview</span>
                        ) : null}
                      </div>

                      {conversation.subject ? (
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 13,
                            color: "var(--muted, #6b7280)",
                          }}
                        >
                          {otherParticipants}
                        </p>
                      ) : null}

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

                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--muted, #9ca3af)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conversation.lastMessage
                        ? formatTimestamp(conversation.lastMessage.createdAt)
                        : formatTimestamp(conversation.updatedAt)}
                    </span>
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
