import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getStudentChapterJourneyData } from "@/lib/chapter-pathway-journey";
import { getMyChapterHomeData } from "@/lib/chapter-member-actions";
import { getChapterGamificationSummary } from "@/lib/chapter-gamification-actions";
import { FallbackRequestButton } from "./fallback-request-button";

function formatDateRange(startDate: Date, endDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatDeliveryMode(mode: "IN_PERSON" | "VIRTUAL" | "HYBRID") {
  return mode.replace("_", " ");
}

function statusTone(status: string | null | undefined) {
  switch (status) {
    case "COMPLETED":
      return { background: "#dcfce7", color: "#166534" };
    case "ENROLLED":
      return { background: "#f0e6ff", color: "#5a1da8" };
    case "WAITLISTED":
      return { background: "#fef3c7", color: "#92400e" };
    case "PENDING":
      return { background: "#e0f2fe", color: "#075985" };
    case "APPROVED":
      return { background: "#dcfce7", color: "#166534" };
    case "REJECTED":
    case "CANCELLED":
      return { background: "#fee2e2", color: "#991b1b" };
    default:
      return { background: "#f3f4f6", color: "#374151" };
  }
}

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(date));
}

const ROLE_COLORS: Record<string, string> = {
  CHAPTER_PRESIDENT: "#5a1da8",
  ADMIN: "#dc2626",
  INSTRUCTOR: "#0369a1",
  MENTOR: "#ca8a04",
  STUDENT: "#6b7280",
  STAFF: "#059669",
};

export default async function MyChapterPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  // Load chapter home data, pathway journey, and gamification in parallel
  const [homeData, journey, gamification] = await Promise.all([
    getMyChapterHomeData(),
    getStudentChapterJourneyData(session.user.id).catch(() => null),
    getChapterGamificationSummary().catch(() => null),
  ]);

  // If user has no chapter, redirect to join
  if (!homeData) redirect("/join-chapter");

  const { chapter, members, channels, recentAnnouncements, myEnrollments } = homeData;
  const roles = new Set(session.user.roles ?? []);
  const canReviewFallbacks = roles.has("ADMIN") || roles.has("STAFF") || roles.has("CHAPTER_PRESIDENT");

  // Get pathway data if available
  const localPathways = journey?.activeLocalPathways ?? [];
  const spotlightPathway = localPathways[0] ?? null;

  return (
    <main className="main-content">
      {/* Chapter Header with Branding */}
      <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 24, position: "relative" }}>
        {chapter?.bannerUrl ? (
          <div style={{ height: 140, overflow: "hidden" }}>
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
              height: 140,
              background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 24,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {chapter?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={chapter.logoUrl}
              alt=""
              style={{
                width: 52, height: 52, borderRadius: 12, objectFit: "cover",
                border: "3px solid white",
              }}
            />
          ) : (
            <div
              style={{
                width: 52, height: 52, borderRadius: 12,
                background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 700, fontSize: 20, border: "3px solid white",
              }}
            >
              {chapter?.name?.charAt(0) ?? "C"}
            </div>
          )}
          <div style={{ color: "white", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>{chapter?.name ?? "My Chapter"}</h1>
            {chapter?.tagline && (
              <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{chapter.tagline}</p>
            )}
          </div>
        </div>
        <div
          style={{
            position: "absolute", top: 12, right: 16,
            display: "flex", gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
              color: "white", fontSize: 13,
            }}
          >
            {chapter?._count.users ?? 0} members
          </span>
          <Link href="/my-chapter/calendar" className="button outline small">
            Chapter Calendar
          </Link>
        </div>
      </div>

      <div className="grid two" style={{ alignItems: "start" }}>
        {/* Left Column: Community & Activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Announcements */}
          {recentAnnouncements.length > 0 && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Announcements</h3>
                <Link href="/chapter/updates" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                  View all →
                </Link>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {recentAnnouncements.map((update) => (
                  <div
                    key={update.id}
                    style={{
                      padding: 12, borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: update.isPinned ? "#fefce8" : "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 14 }}>
                        {update.isPinned && "📌 "}{update.title}
                      </strong>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(update.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.4 }}>
                      {update.content.slice(0, 150)}{update.content.length > 150 ? "..." : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Members */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Your Chapter People</h3>
              <Link href="/chapter/members" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                View all →
              </Link>
            </div>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {members.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px 4px 4px",
                    borderRadius: 20,
                    border: "1px solid var(--border)",
                    fontSize: 13,
                  }}
                >
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: ROLE_COLORS[member.primaryRole] ?? "#6b7280",
                      color: "white", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 11, fontWeight: 600,
                    }}
                  >
                    {member.name.charAt(0)}
                  </div>
                  <span>{member.name}</span>
                </div>
              ))}
              {(chapter?._count.users ?? 0) > members.length && (
                <Link
                  href="/chapter/members"
                  style={{
                    padding: "4px 12px", borderRadius: 20, border: "1px dashed var(--border)",
                    fontSize: 13, color: "var(--muted)", textDecoration: "none",
                    display: "flex", alignItems: "center",
                  }}
                >
                  +{(chapter?._count.users ?? 0) - members.length} more
                </Link>
              )}
            </div>
          </div>

          {/* Pathway Progress */}
          {!spotlightPathway && (
            <div className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
              <h3 style={{ margin: "0 0 4px" }}>Start a Pathway</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 10px" }}>
                Explore learning pathways designed for your chapter
              </p>
              <Link
                href="/pathways"
                className="button small"
                style={{ textDecoration: "none", fontSize: 13 }}
              >
                Browse Pathways
              </Link>
            </div>
          )}
          {spotlightPathway && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Your Pathway Progress</h3>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{spotlightPathway.name}</strong>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>
                      {spotlightPathway.completedCount}/{spotlightPathway.totalCount} steps
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--ypp-purple)" }}>
                    {spotlightPathway.progressPercent}%
                  </span>
                </div>
                <div style={{ marginTop: 8, height: 8, background: "var(--border)", borderRadius: 4 }}>
                  <div
                    style={{
                      width: `${spotlightPathway.progressPercent}%`,
                      height: "100%", borderRadius: 4, background: "var(--ypp-purple)",
                    }}
                  />
                </div>
                {spotlightPathway.nextRecommendedStep && (
                  <p style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>
                    Next: Step {spotlightPathway.nextRecommendedStep.stepOrder} — {spotlightPathway.nextRecommendedStep.title}
                  </p>
                )}
              </div>
              {localPathways.length > 1 && (
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {localPathways.slice(1, 4).map((pw) => (
                    <Link
                      key={pw.id}
                      href={`/pathways/${pw.id}`}
                      style={{
                        fontSize: 12, padding: "4px 10px", borderRadius: 20,
                        border: "1px solid var(--border)", textDecoration: "none",
                        color: "var(--text)",
                      }}
                    >
                      {pw.name} ({pw.progressPercent}%)
                    </Link>
                  ))}
                </div>
              )}
              <Link
                href="/pathways"
                style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--ypp-purple)" }}
              >
                View all pathways →
              </Link>
            </div>
          )}

          {/* My Enrollments */}
          {myEnrollments.length > 0 && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0 }}>My Classes</h3>
                <Link href="/my-classes" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                  Open hub →
                </Link>
              </div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {myEnrollments.map((enrollment) => (
                  <Link
                    key={enrollment.id}
                    href={`/curriculum/${enrollment.offering.id}`}
                    style={{
                      display: "block", padding: "8px 12px", borderRadius: 8,
                      border: "1px solid var(--border)", textDecoration: "none", color: "inherit",
                      fontSize: 14,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <span>{enrollment.offering.title}</span>
                      <span className="pill" style={statusTone(enrollment.status)}>
                        {enrollment.status === "WAITLISTED" ? "Waitlisted" : "Enrolled"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Channels, Events, Quick Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Channels */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Chapter Channels</h3>
              <Link href="/chapter/channels" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                View all →
              </Link>
            </div>
            {channels.length === 0 ? (
              <div style={{ marginTop: 10, textAlign: "center", padding: "12px 0" }}>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 6px" }}>
                  No channels yet
                </p>
                {canReviewFallbacks && (
                  <Link
                    href="/chapter/channels"
                    style={{ fontSize: 12, color: "var(--ypp-purple)" }}
                  >
                    Create one →
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {channels.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/chapter/channels/${ch.id}`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                      textDecoration: "none", color: "inherit", fontSize: 14,
                    }}
                  >
                    <span># {ch.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {ch._count.messages} msgs
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="card">
            <h3 style={{ margin: 0 }}>Upcoming Events</h3>
            {(!chapter?.events || chapter.events.length === 0) ? (
              <div style={{ marginTop: 10, textAlign: "center", padding: "12px 0" }}>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                  No upcoming events — check back soon!
                </p>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {chapter.events.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "8px 0", borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <div
                      style={{
                        width: 42, height: 42, borderRadius: 8, background: "var(--bg)",
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                        {new Date(event.startDate).getDate()}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
                        {new Date(event.startDate).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{event.title}</p>
                      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
                        {event.eventType}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gamification Widget */}
          {gamification && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Your Progress</h3>
                <Link href="/chapter/leaderboard" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
                  Leaderboard →
                </Link>
              </div>
              {/* XP & Level */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--ypp-purple), var(--ypp-pink))",
                    color: "white", display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 700, fontSize: 16,
                  }}
                >
                  {gamification.user.level}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <strong>{gamification.user.title}</strong>
                    <span style={{ color: "var(--ypp-purple)", fontWeight: 700 }}>
                      {gamification.user.xp.toLocaleString()} XP
                    </span>
                  </div>
                  <div style={{ marginTop: 4, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${gamification.user.progress * 100}%`,
                        height: "100%", borderRadius: 3,
                        background: "linear-gradient(90deg, var(--ypp-purple), var(--ypp-pink))",
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}>
                    Rank #{gamification.user.rank} of {gamification.user.totalMembers}
                  </div>
                </div>
              </div>
              {/* Top 3 Mini Leaderboard */}
              {gamification.topMembers.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {gamification.topMembers.slice(0, 3).map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "4px 0", fontSize: 13,
                        borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span style={{ width: 16, fontWeight: 700, color: "var(--muted)", fontSize: 12 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1 }}>{m.name}</span>
                      <span style={{ fontWeight: 600, color: "var(--ypp-purple)", fontSize: 12 }}>
                        {m.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Recent Milestones */}
              {gamification.recentMilestones.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <Link
                    href="/chapter/achievements"
                    style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
                  >
                    Recent Achievements:
                  </Link>
                  <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                    {gamification.recentMilestones.map((m: { icon: string; title: string }, i: number) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 12, padding: "2px 8px", borderRadius: 6,
                          background: "var(--bg)", display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {m.icon} {m.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Links */}
          <div className="card">
            <h3 style={{ margin: 0 }}>Quick Links</h3>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <Link href="/pathways" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                🗺 Pathways
              </Link>
              <Link href="/curriculum" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                📖 Browse Classes
              </Link>
              <Link href="/chapter/channels" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                💬 Channels
              </Link>
              <Link href="/chapter/members" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                👥 Members
              </Link>
              <Link href="/chapter/leaderboard" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                🏆 Leaderboard
              </Link>
              <Link href="/chapter/achievements" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                🎯 Achievements
              </Link>
              <Link href="/messages" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                ✉️ Messages
              </Link>
              {canReviewFallbacks && (
                <Link href="/chapter/pathway-fallbacks" className="action-btn" style={{ textDecoration: "none", fontSize: 13 }}>
                  🔄 Fallbacks
                </Link>
              )}
            </div>
          </div>

          {/* Chapter Stats */}
          <div className="card" style={{ background: "var(--bg)" }}>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div className="kpi" style={{ fontSize: 20 }}>{chapter?._count.users ?? 0}</div>
                <div className="kpi-label">Members</div>
              </div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div className="kpi" style={{ fontSize: 20 }}>{chapter?._count.courses ?? 0}</div>
                <div className="kpi-label">Courses</div>
              </div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div className="kpi" style={{ fontSize: 20 }}>{localPathways.length}</div>
                <div className="kpi-label">Pathways</div>
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
              {chapter?.slug && (
                <Link
                  href={`/chapters/${chapter.slug}`}
                  style={{
                    fontSize: 12, color: "var(--ypp-purple)",
                  }}
                >
                  View public chapter page →
                </Link>
              )}
              <Link href="/chapters" style={{ fontSize: 12, color: "var(--muted)" }}>
                Explore other chapters →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
