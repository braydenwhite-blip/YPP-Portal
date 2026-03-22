import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildChapterPublicProfile } from "@/lib/chapter-calendar";

type PublicChapterProfilePageProps = {
  params: {
    slug: string;
  };
};

export default async function PublicChapterProfilePage({ params }: PublicChapterProfilePageProps) {
  const session = await getServerSession(authOptions);
  const profile = await buildChapterPublicProfile(params.slug);

  if (!profile) {
    notFound();
  }

  const { chapter, memberCount, activePrograms, publicEvents, chapterPresident } = profile;
  const publicFeedUrl = `/api/chapter-calendar/feed?slug=${params.slug}&public=1`;

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}>
      <section
        style={{
          padding: "56px 24px 40px",
          background: chapter.calendarThemeColor
            ? `linear-gradient(135deg, ${chapter.calendarThemeColor} 0%, #0f172a 100%)`
            : "linear-gradient(135deg, #1d4ed8 0%, #0f172a 100%)",
          color: "white",
        }}
      >
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 760 }}>
              <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.9 }}>
                Youth Passion Project Chapter
              </p>
              <h1 style={{ margin: "10px 0 12px", fontSize: "clamp(2.25rem, 5vw, 4rem)", lineHeight: 1.05 }}>
                {chapter.name}
              </h1>
              <p style={{ margin: 0, maxWidth: 680, fontSize: 18, lineHeight: 1.6, opacity: 0.94 }}>
                {chapter.publicSummary ||
                  "This chapter is building local momentum around meaningful programs, chapter-owned events, and community learning."}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignSelf: "flex-start" }}>
              <a href={publicFeedUrl} className="button" style={{ textDecoration: "none" }}>
                Public Calendar Feed
              </a>
              {session?.user ? (
                <Link href="/my-chapter/calendar" className="button outline" style={{ textDecoration: "none", background: "white", color: "#0f172a" }}>
                  Open My Chapter Calendar
                </Link>
              ) : (
                <Link href="/login" className="button outline" style={{ textDecoration: "none", background: "white", color: "#0f172a" }}>
                  Sign in for more
                </Link>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            {(chapter.city || chapter.region) ? (
              <span className="pill" style={{ background: "rgba(255,255,255,0.14)", color: "white" }}>
                {[chapter.city, chapter.region].filter(Boolean).join(", ")}
              </span>
            ) : null}
            {chapter.partnerSchool ? (
              <span className="pill" style={{ background: "rgba(255,255,255,0.14)", color: "white" }}>
                Partner: {chapter.partnerSchool}
              </span>
            ) : null}
            <span className="pill" style={{ background: "rgba(255,255,255,0.14)", color: "white" }}>
              {memberCount} members
            </span>
            <span className="pill" style={{ background: "rgba(255,255,255,0.14)", color: "white" }}>
              {activePrograms.length} active programs
            </span>
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px 64px" }}>
        <div className="grid two" style={{ gap: 20, marginBottom: 24 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Chapter story</h2>
            <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {chapter.publicStory ||
                "This chapter profile is live, but the chapter team has not written its public story yet. Check back soon for more detail about its programs, goals, and local community."}
            </p>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Safe chapter outcomes</h2>
            <div className="grid two" style={{ gap: 12 }}>
              <div>
                <div className="kpi">{memberCount}</div>
                <div className="kpi-label">Members</div>
              </div>
              <div>
                <div className="kpi">{activePrograms.length}</div>
                <div className="kpi-label">Programs</div>
              </div>
              <div>
                <div className="kpi">{publicEvents.length}</div>
                <div className="kpi-label">Public calendar items</div>
              </div>
              <div>
                <div className="kpi">{chapterPresident?.name ? 1 : 0}</div>
                <div className="kpi-label">Active chapter president</div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid two" style={{ gap: 20, marginBottom: 24 }}>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Programs and pathways</h2>
            {activePrograms.length === 0 ? (
              <p className="empty">No public program details are ready yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {activePrograms.map((program) => (
                  <article key={program.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                    <strong>{program.title}</strong>
                    <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                      {program.deliveryMode.replace(/_/g, " ")}
                      {program.semester ? ` · ${program.semester}` : ""}
                    </p>
                    <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                      {program.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
                      {program.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0 }}>Leadership and contact</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>Chapter President</div>
                <div style={{ color: "var(--text-secondary)" }}>
                  {chapterPresident?.name || "Not published yet"}
                </div>
              </div>
              {chapter.publicContactEmail ? (
                <div>
                  <div style={{ fontWeight: 600 }}>Email</div>
                  <a href={`mailto:${chapter.publicContactEmail}`}>{chapter.publicContactEmail}</a>
                </div>
              ) : null}
              {chapter.publicContactUrl ? (
                <div>
                  <div style={{ fontWeight: 600 }}>More information</div>
                  <a href={chapter.publicContactUrl} target="_blank" rel="noreferrer">
                    {chapter.publicContactUrl}
                  </a>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h2 style={{ marginTop: 0, marginBottom: 6 }}>Public chapter calendar</h2>
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                Only chapter events and milestones marked public appear here.
              </p>
            </div>
            <a href={publicFeedUrl} className="button outline" style={{ textDecoration: "none" }}>
              Download public iCal
            </a>
          </div>

          {publicEvents.length === 0 ? (
            <p className="empty">No public chapter events are scheduled right now.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {publicEvents.map((entry) => (
                <article key={entry.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="pill" style={{ background: `${entry.eventTypeColor}22`, color: entry.eventTypeColor }}>
                          {entry.eventTypeLabel}
                        </span>
                      </div>
                      <strong>{entry.title}</strong>
                      <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        {new Date(entry.startDate).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: entry.allDay ? undefined : "numeric",
                          minute: entry.allDay ? undefined : "2-digit",
                        })}
                      </p>
                      {entry.description ? (
                        <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>{entry.description}</p>
                      ) : null}
                    </div>
                    {entry.meetingUrl ? (
                      <a href={entry.meetingUrl} className="button small" target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
