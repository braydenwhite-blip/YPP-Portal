import Link from "next/link";
import { requirePageRoles } from "@/lib/page-guards";
import { getChapterMembers } from "@/lib/chapter-member-actions";
import { PersonLink } from "@/components/people-strategy/person-link";
import { MemberSearch } from "./member-search";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CHAPTER_PRESIDENT: { label: "Chapter President", color: "#5a1da8", bg: "#f0e6ff" },
  ADMIN: { label: "Admin", color: "#dc2626", bg: "#fee2e2" },
  INSTRUCTOR: { label: "Instructor", color: "#0369a1", bg: "#e0f2fe" },
  MENTOR: { label: "Mentor", color: "#ca8a04", bg: "#fef3c7" },
  STUDENT: { label: "Student", color: "#374151", bg: "#f3f4f6" },
  STAFF: { label: "Staff", color: "#059669", bg: "#dcfce7" },
  PARENT: { label: "Parent", color: "#6b21c8", bg: "#f5f3ff" },
};

export default async function ChapterMembersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const members = await getChapterMembers(searchParams.q);

  // Group by role
  const grouped: Record<string, typeof members> = {};
  for (const member of members) {
    const role = member.primaryRole;
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(member);
  }

  const roleOrder = ["CHAPTER_PRESIDENT", "ADMIN", "INSTRUCTOR", "MENTOR", "STUDENT", "STAFF", "PARENT"];

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Command Center
          </Link>
          <h1>Chapter Members</h1>
          <p className="page-subtitle">
            {members.length} {members.length === 1 ? "member" : "members"} across your chapter
          </p>
        </div>
        <Link href="/chapter/invites" className="button" style={{ textDecoration: "none" }}>
          Invite Members
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
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: info.color,
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {(member.name || member.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                            <PersonLink id={member.id} style={{ color: "inherit" }}>
                              {member.name || "Unnamed member"}
                            </PersonLink>
                          </p>
                          <a
                            href={`mailto:${member.email}`}
                            title={`Email ${member.name || member.email}`}
                            style={{
                              margin: 0,
                              display: "block",
                              fontSize: 12,
                              color: "var(--ypp-purple)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.email}
                          </a>
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
