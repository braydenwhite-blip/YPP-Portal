import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getInstructorParentConversations,
  sendParentMessage,
} from "@/lib/parent-message-actions";

export default async function InstructorParentMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_PRESIDENT")
  ) {
    redirect("/");
  }

  const conversations = await getInstructorParentConversations();
  const currentUserId = session.user.id;

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Instructor</p>
          <h1 className="page-title">Parent Messages</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Conversations with parents of your enrolled students
          </p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✉</div>
          <h3 style={{ margin: "0 0 8px" }}>No parent messages yet</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>
            Parents of students enrolled in your courses can message you here.
            Threads will appear once a parent initiates contact.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {conversations.map((conv) => {
            const parentParticipants = conv.participants.filter(
              (p) => p.id !== currentUserId
            );

            async function handleReply(formData: FormData) {
              "use server";
              formData.set("conversationId", conv.conversationId);
              formData.set("studentId", "");
              await sendParentMessage(formData);
            }

            return (
              <div key={conv.conversationId} className="card" style={{ padding: 0, overflow: "hidden" }}>
                {/* Thread Header */}
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: conv.hasUnread ? "var(--surface-alt)" : "transparent",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {conv.hasUnread && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "var(--ypp-purple)",
                            display: "inline-block",
                          }}
                        />
                      )}
                      <strong style={{ fontSize: 14 }}>{conv.subject}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {parentParticipants.length > 0
                        ? `From: ${parentParticipants.map((p) => p.name).join(", ")}`
                        : "Unknown parent"}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(conv.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>

                {/* Messages */}
                <div
                  style={{
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {conv.messages.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: 0 }}>
                      No messages yet.
                    </p>
                  ) : (
                    conv.messages.map((msg) => {
                      const isOwn = msg.senderId === currentUserId;
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isOwn ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "75%",
                              padding: "8px 12px",
                              borderRadius: isOwn
                                ? "16px 16px 4px 16px"
                                : "16px 16px 16px 4px",
                              background: isOwn
                                ? "var(--ypp-purple)"
                                : "var(--surface-alt)",
                              color: isOwn ? "#fff" : "var(--foreground)",
                              fontSize: 13,
                              lineHeight: 1.5,
                            }}
                          >
                            {msg.content}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--muted)",
                              marginTop: 3,
                              display: "flex",
                              gap: 4,
                            }}
                          >
                            <span>{msg.sender.name}</span>
                            <span>·</span>
                            <span>
                              {new Date(msg.createdAt).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}{" "}
                              {new Date(msg.createdAt).toLocaleTimeString(
                                "en-US",
                                { hour: "numeric", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Form */}
                <div
                  style={{
                    borderTop: "1px solid var(--border)",
                    padding: "10px 16px",
                    background: "var(--surface-alt)",
                  }}
                >
                  <form action={handleReply} style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      name="content"
                      placeholder="Reply to parent..."
                      required
                      style={{ flex: 1, margin: 0, fontSize: 13 }}
                      autoComplete="off"
                    />
                    <button type="submit" className="button small" style={{ flexShrink: 0 }}>
                      Reply
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          padding: "10px 14px",
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
          color: "var(--muted)",
          borderLeft: "3px solid var(--border)",
        }}
      >
        Only parents of students enrolled in your courses can initiate conversations here.
        Messages are private between you and the parent.
      </div>
    </div>
  );
}
