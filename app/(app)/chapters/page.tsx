import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPublicChapters } from "@/lib/chapter-join-actions";
import { slugifyChapterName } from "@/lib/chapter-calendar";
import { ChapterDirectoryClient } from "./chapter-directory-client";

export default async function ChaptersPage() {
  const session = await getServerSession(authOptions);
  const chapters = await getPublicChapters();

  // Extract unique locations for filter
  const locations = Array.from(
    new Set(
      chapters
        .map((c) => [c.city, c.region].filter(Boolean).join(", "))
        .filter(Boolean)
    )
  ).sort();

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/chapters/leaderboard"
            style={{ fontSize: 13, color: "var(--ypp-purple)", textDecoration: "none" }}
          >
            Leaderboard
          </Link>
          {session?.user ? (
            <Link href="/chapters/propose" className="button small" style={{ textDecoration: "none" }}>
              Propose New Chapter
            </Link>
          ) : null}
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏘</div>
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
        <ChapterDirectoryClient
          chapters={chapters.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug || slugifyChapterName(c.name),
            city: c.city,
            region: c.region,
            tagline: c.tagline,
            logoUrl: c.logoUrl,
            bannerUrl: c.bannerUrl,
            joinPolicy: c.joinPolicy,
            memberCount: c._count.users,
            courseCount: c._count.courses,
            eventCount: c._count.events,
          }))}
          locations={locations}
        />
      )}
    </div>
  );
}
