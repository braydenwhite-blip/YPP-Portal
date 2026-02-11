import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function StudyGroupPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const group = await prisma.studyGroup.findUnique({
    where: { id: params.id },
    include: {
      course: true,
      createdBy: true,
      members: {
        include: { user: true },
        orderBy: { joinedAt: "asc" }
      },
      messages: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 50
      },
      resources: {
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!group) {
    redirect("/study-groups");
  }

  const userMembership = group.members.find(m => m.userId === session.user.id);

  if (!userMembership) {
    redirect("/study-groups");
  }

  const canModerate = userMembership.role === "CREATOR" || userMembership.role === "MODERATOR";

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/study-groups" style={{ color: "inherit", textDecoration: "none" }}>
              Study Groups
            </Link>
          </p>
          <h1 className="page-title">{group.name}</h1>
        </div>
      </div>

      <div className="grid two" style={{ gap: 24 }}>
        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Group info */}
          <div className="card">
            <h3>About This Group</h3>
            <p style={{ marginTop: 8 }}>
              {group.description || "No description provided"}
            </p>
            <div style={{ marginTop: 12 }}>
              <span className="pill">{group.course.title}</span>
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Created by {group.createdBy.name}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Group Chat</h3>
              <span className="pill">{group.messages.length} messages</span>
            </div>

            {/* Message form */}
            <form action="/api/study-groups/messages" method="POST" style={{ marginBottom: 20 }}>
              <input type="hidden" name="groupId" value={group.id} />
              <textarea
                name="content"
                placeholder="Send a message to the group..."
                required
                style={{
                  width: "100%",
                  minHeight: 80,
                  padding: 12,
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
              <button type="submit" className="button primary" style={{ marginTop: 8 }}>
                Send Message
              </button>
            </form>

            {/* Messages list */}
            <div style={{ display: "flex", flexDirection: "column-reverse", gap: 16 }}>
              {group.messages.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 20 }}>
                  No messages yet. Start the conversation!
                </p>
              ) : (
                group.messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      padding: 12,
                      backgroundColor: message.userId === session.user.id ? "var(--accent-bg)" : "transparent",
                      borderRadius: 6,
                      border: "1px solid var(--border-color)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div style={{ fontWeight: 600 }}>
                        {message.user.name}
                        {message.userId === group.createdById && (
                          <span className="pill primary" style={{ marginLeft: 8, fontSize: 10 }}>
                            Creator
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Members */}
          <div className="card">
            <h3>Members ({group.members.length})</h3>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {group.members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    padding: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderRadius: 4,
                    backgroundColor: member.userId === session.user.id ? "var(--accent-bg)" : "transparent"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{member.user.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {member.role === "CREATOR" && (
                    <span className="pill primary">Creator</span>
                  )}
                  {member.role === "MODERATOR" && (
                    <span className="pill secondary">Moderator</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3>Resources</h3>
              <span className="pill">{group.resources.length}</span>
            </div>

            {/* Upload form */}
            <form action="/api/study-groups/resources" method="POST" style={{ marginBottom: 20 }}>
              <input type="hidden" name="groupId" value={group.id} />
              <input
                type="text"
                name="title"
                placeholder="Resource title"
                required
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  marginBottom: 8
                }}
              />
              <input
                type="url"
                name="url"
                placeholder="Resource URL"
                required
                style={{
                  width: "100%",
                  padding: 8,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  marginBottom: 8
                }}
              />
              <textarea
                name="description"
                placeholder="Description (optional)"
                style={{
                  width: "100%",
                  minHeight: 60,
                  padding: 8,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  marginBottom: 8
                }}
              />
              <button type="submit" className="button secondary small" style={{ width: "100%" }}>
                Add Resource
              </button>
            </form>

            {/* Resources list */}
            {group.resources.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 12 }}>
                No resources yet
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {group.resources.map((resource) => (
                  <div
                    key={resource.id}
                    style={{
                      padding: 12,
                      border: "1px solid var(--border-color)",
                      borderRadius: 6
                    }}
                  >
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: "var(--primary-color)", textDecoration: "none" }}
                    >
                      {resource.title} ↗
                    </a>
                    {resource.description && (
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                        {resource.description}
                      </p>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                      Added by {resource.uploadedBy.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Leave group */}
          <form action="/api/study-groups/leave" method="POST">
            <input type="hidden" name="groupId" value={group.id} />
            <button
              type="submit"
              className="button"
              style={{
                width: "100%",
                backgroundColor: "var(--error-bg)",
                color: "var(--error-color)"
              }}
            >
              Leave Group
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
