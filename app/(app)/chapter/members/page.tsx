import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getChapterMembers } from "@/lib/chapter-member-actions";
import { MemberSearch } from "./member-search";
import UserAvatar from "@/components/user-avatar";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CHAPTER_LEAD: { label: "Chapter Lead", color: "#6d28d9", bg: "#ede9fe" },
  ADMIN: { label: "Admin", color: "#dc2626", bg: "#fee2e2" },
  INSTRUCTOR: { label: "Instructor", color: "#0369a1", bg: "#e0f2fe" },
  MENTOR: { label: "Mentor", color: "#ca8a04", bg: "#fef3c7" },
  STUDENT: { label: "Student", color: "#374151", bg: "#f3f4f6" },
  STAFF: { label: "Staff", color: "#059669", bg: "#dcfce7" },
  PARENT: { label: "Parent", color: "#7c3aed", bg: "#f5f3ff" },
};

export default async function ChapterMembersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const members = await getChapterMembers(searchParams.q);

  // Group by role
  const grouped: Record<string, typeof members> = {};
  for (const member of members) {
    const role = member.primaryRole;
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(member);
  }

  const roleOrder = ["CHAPTER_LEAD", "ADMIN", "INSTRUCTOR", "MENTOR", "STUDENT", "STAFF", "PARENT"];

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Members</h1>
          <p className="subtitle">{members.length} members</p>
        </div>
        <Link href="/my-chapter" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Chapter Home
        </Link>
      </div>

      <MemberSearch defaultValue={searchParams.q} />

      {members.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ color: "var(--muted)" }}>
            {searchParams.q ? "No members match your search." : "No members in this chapter yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {roleOrder
            .filter((role) => grouped[role]?.length)
            .map((role) => {
              const info = ROLE_LABELS[role] ?? { label: role, color: "#374151", bg: "#f3f4f6" };
              return (
                <div key={role}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: info.bg,
                        color: info.color,
                      }}
                    >
                      {info.label}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {grouped[role]!.length}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                    {grouped[role]!.map((member) => (
                      <div
                        key={member.id}
                        className="card"
                        style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}
                      >
                        <UserAvatar
                          avatarUrl={(member as any).profile?.avatarUrl ?? (member as any).image}
                          userName={member.name}
                          size="md"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{member.name}</p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: 12,
                              color: "var(--muted)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.email}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
                            Joined {new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </main>
  );
}
