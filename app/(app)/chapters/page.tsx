import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPublicChapters } from "@/lib/chapter-join-actions";

export default async function ChaptersPage() {
  const session = await getServerSession(authOptions);
  const chapters = await getPublicChapters();

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Network</p>
          <h1 className="page-title">Find Your Chapter</h1>
          <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 14 }}>
            Join a chapter near you and become part of a local community of learners and leaders.
          </p>
        </div>
        {session?.user ? (
          <Link href="/chapters/propose" className="button small" style={{ textDecoration: "none" }}>
            Propose New Chapter
          </Link>
        ) : null}
      </div>

      {chapters.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <h3>No chapters yet</h3>
          <p style={{ color: "var(--muted)", marginTop: 8 }}>
            Be the first to start a chapter in your area!
          </p>
          {session?.user && (
            <Link href="/chapters/propose" className="button" style={{ marginTop: 16, textDecoration: "none" }}>
              Propose a Chapter
            </Link>
          )}
        </div>
      ) : (
        <div className="grid two">
          {chapters.map((chapter) => {
            const href = chapter.slug ? `/chapters/${chapter.slug}` : null;
            const location = [chapter.city, chapter.region].filter(Boolean).join(", ");

            return (
              <div
                key={chapter.id}
                className="card"
                style={{ overflow: "hidden", padding: 0 }}
              >
                {/* Banner */}
                {chapter.bannerUrl ? (
                  <div style={{ height: 100, overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={chapter.bannerUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      height: 100,
                      background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
                    }}
                  />
                )}

                <div style={{ padding: 20 }}>
                  {/* Header with logo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: -36 }}>
                    {chapter.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={chapter.logoUrl}
                        alt=""
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "3px solid var(--card-bg, white)",
                          background: "white",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          background: "var(--ypp-purple)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 18,
                          border: "3px solid var(--card-bg, white)",
                        }}
                      >
                        {chapter.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{chapter.name}</h3>
                      {location && (
                        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{location}</p>
                      )}
                    </div>
                  </div>

                  {/* Tagline */}
                  {chapter.tagline && (
                    <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 12, lineHeight: 1.4 }}>
                      {chapter.tagline}
                    </p>
                  )}

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>{chapter._count.users}</div>
                      <div className="kpi-label">Members</div>
                    </div>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>{chapter._count.courses}</div>
                      <div className="kpi-label">Courses</div>
                    </div>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>{chapter._count.events}</div>
                      <div className="kpi-label">Upcoming</div>
                    </div>
                  </div>

                  {/* Join Policy Badge + CTA */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: chapter.joinPolicy === "OPEN" ? "#dcfce7" : chapter.joinPolicy === "APPROVAL" ? "#fef3c7" : "#f3f4f6",
                        color: chapter.joinPolicy === "OPEN" ? "#166534" : chapter.joinPolicy === "APPROVAL" ? "#92400e" : "#374151",
                      }}
                    >
                      {chapter.joinPolicy === "OPEN" && "Open to join"}
                      {chapter.joinPolicy === "APPROVAL" && "Application required"}
                      {chapter.joinPolicy === "INVITE_ONLY" && "Invite only"}
                    </span>

                    {href ? (
                      <Link
                        href={href}
                        className="button small"
                        style={{ textDecoration: "none", fontSize: 13 }}
                      >
                        View Chapter
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
