import Link from "next/link";
import { requirePageRoles } from "@/lib/page-guards";
import { getChapterUpdates, createChapterUpdate, deleteChapterUpdate } from "@/lib/chapter-actions";
import { ConfirmSubmitButton } from "@/components/chapter-dashboard/confirm-submit-button";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { value: "INSTRUCTOR", label: "Instructors" },
  { value: "STUDENT", label: "Students" },
  { value: "MENTOR", label: "Mentors" },
];

export default async function ChapterUpdatesPage() {
  await requirePageRoles(["CHAPTER_PRESIDENT", "ADMIN"]);

  const updates = await getChapterUpdates();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <Link href="/chapter" className="back-link">
            ← Command Center
          </Link>
          <h1>Chapter Announcements</h1>
          <p className="page-subtitle">
            Post updates to your whole chapter or target specific roles.
          </p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 16 }}>Post an Announcement</h2>
        <form action={createChapterUpdate} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Title</span>
            <input
              type="text"
              name="title"
              required
              maxLength={140}
              className="input"
              placeholder="e.g. Spring kickoff meeting moved to Friday"
            />
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Message</span>
            <textarea
              name="content"
              rows={4}
              required
              maxLength={4000}
              className="input"
              placeholder="Write your announcement…"
            />
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Who should see this?
            </span>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              Leave all unchecked to show this to the whole chapter.
            </p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.value}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}
                >
                  <input type="checkbox" name="targetRoles" value={role.value} />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input type="checkbox" name="isPinned" value="true" />
              Pin to top
            </label>
            <button type="submit" className="button">
              Post Announcement
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Posted Announcements</h2>
        {updates.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No announcements yet. Post your first update above to keep your
              chapter in the loop.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {updates.map((update) => (
              <div
                key={update.id}
                className="card"
                style={
                  update.isPinned
                    ? { borderColor: "var(--ypp-purple-300, #d4b8ff)", background: "var(--ypp-purple-50, #faf7ff)" }
                    : undefined
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {update.isPinned && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--ypp-purple)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        📌 Pinned
                      </span>
                    )}
                    <h3 style={{ margin: "2px 0 4px", fontSize: 15 }}>{update.title}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                      {update.author.name} ·{" "}
                      {new Date(update.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <form action={deleteChapterUpdate.bind(null, update.id)}>
                    <ConfirmSubmitButton
                      className="button small danger"
                      confirm={`Delete the announcement "${update.title}"? This cannot be undone.`}
                      pendingText="Deleting…"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {update.content}
                </p>
                {update.targetRoles.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Visible to:</span>
                    {update.targetRoles.map((role) => (
                      <span
                        key={role}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "var(--surface-alt, #f1f5f9)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {role.charAt(0) + role.slice(1).toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
