import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getOrCreateParentConversation,
  sendParentMessage,
} from "@/lib/parent-message-actions";

export default async function ParentStudentMessagesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) redirect("/");

  const conversation = await getOrCreateParentConversation(studentId);
  const currentUserId = session.user.id;

  // Find student name from the subject (format: "[Name] — Parent Updates")
  const studentName =
    conversation.subject?.replace(" — Parent Updates", "") ?? "Student";

  const otherParticipants = conversation.participants
    .filter((p) => p.userId !== currentUserId)
    .map((p) => p.user);

  async function handleSend(formData: FormData) {
    "use server";
    formData.set("conversationId", conversation.id);
    formData.set("studentId", studentId);
    await sendParentMessage(formData);
  }

  return (
    <div className="main-content">
      <div className="topbar">
        <div>
          <Link
            href={`/parent/${studentId}`}
            style={{ fontSize: 13, color: "var(--muted)" }}
          >
            &larr; Back to {studentName}
          </Link>
          <h1 className="page-title">
            Messages — {studentName}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {otherParticipants.length > 0
              ? `Thread with ${otherParticipants.map((p) => p.name).join(", ")}`
              : "No instructor assigned yet — messages will be visible to admins."}
          </p>
        </div>
      </div>

      {/* Message Thread */}
      <div
        className="card"
        style={{
          padding: 0,
          overflow: "hidden",
          marginBottom: 16,
        }}
      >
        {/* Messages list */}
        <div
          style={{
            padding: "16px 16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 120,
          }}
        >
          {conversation.messages.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 16px",
                color: "var(--muted)",
                fontSize: 14,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>💬</div>
              No messages yet. Start the conversation below.
            </div>
          ) : (
            conversation.messages.map((msg) => {
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
                      padding: "10px 14px",
                      borderRadius: isOwn
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                      background: isOwn
                        ? "var(--ypp-purple)"
                        : "var(--surface-alt)",
                      color: isOwn ? "#fff" : "var(--foreground)",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.content}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginTop: 4,
                      display: "flex",
                      gap: 6,
                    }}
                  >
                    <span>{msg.sender.name}</span>
                    <span>·</span>
                    <span>
                      {new Date(msg.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Send Form */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 16px",
            background: "var(--surface-alt)",
          }}
        >
          <form action={handleSend} style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              name="content"
              placeholder="Type a message..."
              required
              style={{ flex: 1, margin: 0 }}
              autoComplete="off"
            />
            <button type="submit" className="button" style={{ flexShrink: 0 }}>
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Info note */}
      <div
        style={{
          padding: "10px 14px",
          background: "var(--surface-alt)",
          borderRadius: "var(--radius-sm)",
          fontSize: 12,
          color: "var(--muted)",
          borderLeft: "3px solid var(--border)",
        }}
      >
        Messages are shared with your child&apos;s assigned instructor. Response times may vary.
        For urgent matters, please contact the chapter directly.
      </div>
    </div>
  );
}
