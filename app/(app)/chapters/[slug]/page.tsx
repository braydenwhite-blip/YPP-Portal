import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getChapterBySlug, getMyJoinRequestStatus } from "@/lib/chapter-join-actions";
import { JoinChapterButton } from "./join-chapter-button";

type ChapterProfile = NonNullable<Awaited<ReturnType<typeof getChapterBySlug>>>;

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

export default async function ChapterProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const chapter = await getChapterBySlug(params.slug);
  if (!chapter) notFound();

  const session = await getSession();

  // Check if user is already a member or has a pending request
  let userChapterId: string | null = null;
  let joinRequestStatus: string | null = null;

  if (session?.user?.id) {
    const { prisma } = await import("@/lib/prisma");
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { chapterId: true },
    });
    userChapterId = user?.chapterId ?? null;

    const requestStatus = await getMyJoinRequestStatus(chapter.id);
    joinRequestStatus = requestStatus?.status ?? null;
  }

  const isMember = userChapterId === chapter.id;
  const isInAnotherChapter = userChapterId !== null && userChapterId !== chapter.id;
  const location = [chapter.city, chapter.region].filter(Boolean).join(", ");
  const publicFeedUrl = `/api/chapter-calendar/feed?slug=${chapter.slug || params.slug}&public=1`;

  return (
    <main className="main-content">
      {/* Navigation */}
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/chapters" style={{ fontSize: 13, color: "var(--ypp-purple)", textDecoration: "none" }}>
          ← All Chapters
        </Link>
        {isMember && (
          <Link href="/my-chapter" style={{ fontSize: 13, color: "var(--ypp-purple)", textDecoration: "none" }}>
            Go to Chapter Home →
          </Link>
        )}
      </div>

      {/* Banner */}
      <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
        {chapter.bannerUrl ? (
          <div style={{ height: 200, overflow: "hidden" }}>
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
              height: 200,
              background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
            }}
          />
        )}
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {chapter.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chapter.logoUrl}
              alt=""
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                objectFit: "cover",
                border: "3px solid var(--border)",
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 14,
                background: "var(--ypp-purple)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              {chapter.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 style={{ margin: 0 }}>{chapter.name}</h1>
            {chapter.tagline && (
              <p style={{ color: "var(--muted)", fontSize: 15, margin: "4px 0 0" }}>
                {chapter.tagline}
              </p>
            )}
            {location && (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>{location}</p>
            )}
          </div>
        </div>

        {/* Join CTA */}
        <div style={{ flexShrink: 0, display: "grid", gap: 8, justifyItems: "end" }}>
          {!session?.user ? (
            <a href="/login" className="button" style={{ textDecoration: "none" }}>
              Sign in to Join
            </a>
          ) : isMember ? (
            <span
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#dcfce7",
                color: "#166534",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              You&apos;re a member
            </span>
          ) : joinRequestStatus === "PENDING" ? (
            <span
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "#fef3c7",
                color: "#92400e",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Request pending
            </span>
          ) : isInAnotherChapter ? (
            <span style={{ color: "var(--muted)", fontSize: 14 }}>
              You&apos;re in another chapter
            </span>
          ) : (
            <JoinChapterButton
              chapterId={chapter.id}
              joinPolicy={chapter.joinPolicy}
            />
          )}
          <a href={publicFeedUrl} className="button outline small" style={{ textDecoration: "none" }}>
            Public Calendar Feed
          </a>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        {/* Left Column: About */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Stats */}
          <div className="card">
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ textAlign: "center" }}>
                <div className="kpi" style={{ fontSize: 24 }}>{chapter._count.users}</div>
                <div className="kpi-label">Members</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="kpi" style={{ fontSize: 24 }}>{chapter._count.courses}</div>
                <div className="kpi-label">Courses</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="kpi" style={{ fontSize: 24 }}>{chapter._count.events}</div>
                <div className="kpi-label">Upcoming Events</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {(chapter.publicSummary || chapter.description) && (
            <div className="card">
              <h3>About</h3>
              <p style={{ marginTop: 8, lineHeight: 1.6, color: "var(--text)" }}>
                {chapter.publicSummary || chapter.description}
              </p>
            </div>
          )}

          {chapter.publicStory ? (
            <div className="card">
              <h3>Chapter Story</h3>
              <p style={{ marginTop: 8, lineHeight: 1.6, color: "var(--text)" }}>
                {chapter.publicStory}
              </p>
            </div>
          ) : null}

          {/* Pathways */}
          {chapter.pathwayConfigs.length > 0 && (
            <div className="card">
              <h3>Pathways Offered</h3>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {chapter.pathwayConfigs.map((config: ChapterProfile["pathwayConfigs"][number]) => (
                  <span
                    key={config.pathway.id}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      fontSize: 13,
                      background: config.isFeatured ? "var(--ypp-purple)" : "var(--bg)",
                      color: config.isFeatured ? "white" : "var(--text)",
                      border: config.isFeatured ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {config.pathway.name}
                    {config.runStatus === "ACTIVE" && " ●"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Leadership & Events */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Leadership */}
          {chapter.users.length > 0 && (
            <div className="card">
              <h3>Leadership</h3>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {chapter.users.map((leader: ChapterProfile["users"][number]) => (
                  <div key={leader.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--ypp-purple)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {leader.name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{leader.name}</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                        {leader.primaryRole.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {chapter.events.length > 0 && (
            <div className="card">
              <h3>Upcoming Events</h3>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {chapter.events.map((event: ChapterProfile["events"][number]) => (
                  <div
                    key={event.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{event.title}</p>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                      <span style={{ color: "var(--muted)", fontSize: 13 }}>
                        {formatDate(event.startDate)}
                      </span>
                      {event.location && (
                        <span style={{ color: "var(--muted)", fontSize: 13 }}>
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Join Policy Info */}
          <div className="card" style={{ background: "var(--bg)" }}>
            <h3>How to Join</h3>
            <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
              {chapter.joinPolicy === "OPEN" && (
                <>This chapter is open to everyone. Click &ldquo;Join Chapter&rdquo; to become a member instantly.</>
              )}
              {chapter.joinPolicy === "APPROVAL" && (
                <>This chapter requires approval. Submit a request and the chapter president will review your application.</>
              )}
              {chapter.joinPolicy === "INVITE_ONLY" && (
                <>This chapter is invite-only. Contact the chapter president team for an invitation.</>
              )}
            </p>
          </div>

          {(chapter.publicContactEmail || chapter.publicContactUrl) ? (
            <div className="card">
              <h3>Contact</h3>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {chapter.publicContactEmail ? (
                  <a href={`mailto:${chapter.publicContactEmail}`}>{chapter.publicContactEmail}</a>
                ) : null}
                {chapter.publicContactUrl ? (
                  <a href={chapter.publicContactUrl} target="_blank" rel="noreferrer">
                    {chapter.publicContactUrl}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
