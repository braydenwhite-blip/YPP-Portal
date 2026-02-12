import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getStudentShowcase, getMyContent } from "@/lib/engagement-actions";

const CONTENT_TYPE_COLORS: Record<string, string> = {
  VIDEO: "#ef4444",
  ARTICLE: "#3b82f6",
  PROJECT: "#7c3aed",
  TUTORIAL: "#16a34a",
  ART: "#ec4899",
  MUSIC: "#d97706",
  CODE: "#06b6d4",
  OTHER: "#6b7280",
};

export default async function ShowcasePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [showcaseContent, myContent] = await Promise.all([
    getStudentShowcase(),
    getMyContent(),
  ]);

  const featuredContent = showcaseContent.filter(
    (item: any) => item.isFeatured
  );
  const approvedContent = showcaseContent.filter(
    (item: any) => !item.isFeatured
  );

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Student Showcase</h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 2,
            }}
          >
            Discover amazing work from fellow students
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/showcase/submit" className="button primary">
            Share Your Work
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "var(--ypp-purple)",
            }}
          >
            {showcaseContent.length}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            Total Pieces
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#d97706",
            }}
          >
            {featuredContent.length}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            Featured
          </div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#16a34a",
            }}
          >
            {myContent.length}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 4,
            }}
          >
            My Submissions
          </div>
        </div>
      </div>

      {/* Featured Section */}
      {featuredContent.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            Featured Work
          </div>
          <div className="grid two">
            {featuredContent.map((item: any) => (
              <Link
                key={item.id}
                href={`/showcase/${item.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div
                  className="card"
                  style={{
                    border: "2px solid #d97706",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#d97706",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Featured
                  </div>
                  {/* Thumbnail placeholder */}
                  <div
                    style={{
                      width: "100%",
                      height: 120,
                      borderRadius: 8,
                      marginBottom: 12,
                      backgroundColor:
                        CONTENT_TYPE_COLORS[item.contentType] || "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {item.contentType}
                  </div>
                  <h3 style={{ marginBottom: 8 }}>{item.title}</h3>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      marginBottom: 10,
                    }}
                  >
                    by {item.student?.name || "Unknown"}
                    {item.student?.level != null &&
                      ` (Level ${item.student.level})`}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      className="pill"
                      style={{
                        backgroundColor:
                          CONTENT_TYPE_COLORS[item.contentType] || "#6b7280",
                        color: "#fff",
                      }}
                    >
                      {item.contentType}
                    </span>
                    {item.passionArea && (
                      <span className="pill">{item.passionArea}</span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>
                      {item._count?.likes ?? item.likeCount ?? 0} likes
                    </span>
                    <span>
                      {item._count?.comments ?? 0} comments
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Approved Content */}
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          All Showcase Content
        </div>
        {approvedContent.length === 0 && featuredContent.length === 0 ? (
          <div className="card">
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              No content in the showcase yet. Be the first to share your work!
            </p>
          </div>
        ) : approvedContent.length === 0 ? (
          <div className="card">
            <p
              style={{
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              All showcase content is currently featured above.
            </p>
          </div>
        ) : (
          <div className="grid three">
            {approvedContent.map((item: any) => (
              <Link
                key={item.id}
                href={`/showcase/${item.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="card">
                  {/* Thumbnail placeholder */}
                  <div
                    style={{
                      width: "100%",
                      height: 100,
                      borderRadius: 8,
                      marginBottom: 12,
                      backgroundColor:
                        CONTENT_TYPE_COLORS[item.contentType] || "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {item.contentType}
                  </div>
                  <h3 style={{ fontSize: 15, marginBottom: 6 }}>
                    {item.title}
                  </h3>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      marginBottom: 8,
                    }}
                  >
                    by {item.student?.name || "Unknown"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      className="pill"
                      style={{
                        backgroundColor:
                          CONTENT_TYPE_COLORS[item.contentType] || "#6b7280",
                        color: "#fff",
                        fontSize: 11,
                      }}
                    >
                      {item.contentType}
                    </span>
                    {item.passionArea && (
                      <span className="pill" style={{ fontSize: 11 }}>
                        {item.passionArea}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 14,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span>
                      {item._count?.likes ?? item.likeCount ?? 0} likes
                    </span>
                    <span>
                      {item._count?.comments ?? 0} comments
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
