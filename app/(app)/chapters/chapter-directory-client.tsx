"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

type Chapter = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  region: string | null;
  tagline: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  joinPolicy: string;
  memberCount: number;
  courseCount: number;
  eventCount: number;
};

type SortKey = "name" | "members" | "courses";

export function ChapterDirectoryClient({
  chapters,
  locations,
}: {
  chapters: Chapter[];
  locations: string[];
}) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("members");
  const [policyFilter, setPolicyFilter] = useState("");

  const filtered = useMemo(() => {
    let result = chapters;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.tagline?.toLowerCase().includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.region?.toLowerCase().includes(q)
      );
    }

    if (location) {
      result = result.filter((c) => {
        const loc = [c.city, c.region].filter(Boolean).join(", ");
        return loc === location;
      });
    }

    if (policyFilter) {
      result = result.filter((c) => c.joinPolicy === policyFilter);
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "members":
          return b.memberCount - a.memberCount;
        case "courses":
          return b.courseCount - a.courseCount;
        default:
          return 0;
      }
    });

    return result;
  }, [chapters, search, location, sortBy, policyFilter]);

  return (
    <div>
      {/* Search & Filters Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          className="input"
          placeholder="Search chapters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: 180 }}
        />
        {locations.length > 1 && (
          <select
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ flex: "0 0 auto", minWidth: 140 }}
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        )}
        <select
          className="input"
          value={policyFilter}
          onChange={(e) => setPolicyFilter(e.target.value)}
          style={{ flex: "0 0 auto", minWidth: 130 }}
        >
          <option value="">All Policies</option>
          <option value="OPEN">Open to Join</option>
          <option value="APPROVAL">Application Required</option>
          <option value="INVITE_ONLY">Invite Only</option>
        </select>
        <select
          className="input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          style={{ flex: "0 0 auto", minWidth: 120 }}
        >
          <option value="members">Most Members</option>
          <option value="courses">Most Courses</option>
          <option value="name">Alphabetical</option>
        </select>
      </div>

      {/* Results count */}
      <div style={{ marginBottom: 12, fontSize: 13, color: "var(--muted)" }}>
        {filtered.length === chapters.length
          ? `${chapters.length} chapters`
          : `${filtered.length} of ${chapters.length} chapters`}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            No chapters match your search.{" "}
            <button
              onClick={() => {
                setSearch("");
                setLocation("");
                setPolicyFilter("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--ypp-purple)",
                cursor: "pointer",
                fontSize: 14,
                textDecoration: "underline",
              }}
            >
              Clear filters
            </button>
          </p>
        </div>
      ) : (
        <div className="grid two">
          {filtered.map((chapter) => {
            const href = `/chapters/${chapter.slug}`;
            const loc = [chapter.city, chapter.region].filter(Boolean).join(", ");

            return (
              <div
                key={chapter.id}
                className="card"
                style={{ overflow: "hidden", padding: 0 }}
              >
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
                      background:
                        "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
                    }}
                  />
                )}

                <div style={{ padding: 20 }}>
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
                      {loc && (
                        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{loc}</p>
                      )}
                    </div>
                  </div>

                  {chapter.tagline && (
                    <p
                      style={{
                        color: "var(--muted)",
                        fontSize: 14,
                        marginTop: 12,
                        lineHeight: 1.4,
                      }}
                    >
                      {chapter.tagline}
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>
                        {chapter.memberCount}
                      </div>
                      <div className="kpi-label">Members</div>
                    </div>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>
                        {chapter.courseCount}
                      </div>
                      <div className="kpi-label">Courses</div>
                    </div>
                    <div>
                      <div className="kpi" style={{ fontSize: 20 }}>
                        {chapter.eventCount}
                      </div>
                      <div className="kpi-label">Upcoming</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background:
                          chapter.joinPolicy === "OPEN"
                            ? "#dcfce7"
                            : chapter.joinPolicy === "APPROVAL"
                            ? "#fef3c7"
                            : "#f3f4f6",
                        color:
                          chapter.joinPolicy === "OPEN"
                            ? "#166534"
                            : chapter.joinPolicy === "APPROVAL"
                            ? "#92400e"
                            : "#374151",
                      }}
                    >
                      {chapter.joinPolicy === "OPEN" && "Open to join"}
                      {chapter.joinPolicy === "APPROVAL" && "Application required"}
                      {chapter.joinPolicy === "INVITE_ONLY" && "Invite only"}
                    </span>

                    <Link
                      href={href}
                      className="button small"
                      style={{ textDecoration: "none", fontSize: 13 }}
                    >
                      View Chapter
                    </Link>
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
