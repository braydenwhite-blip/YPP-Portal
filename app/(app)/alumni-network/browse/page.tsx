import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAlumniDirectory, getMyIntroRequests } from "@/lib/alumni-network-actions";
import Link from "next/link";
import IntroRequestClient from "./intro-request-client";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Browse Alumni — YPP" };

const TIER_INTRO_LIMITS: Record<string, number> = {
  BRONZE: 1,
  SILVER: 3,
  GOLD: 5,
  LIFETIME: 10,
};

export default async function BrowseAlumniPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id as string;

  const [alumni, introData, summary] = await Promise.all([
    getAlumniDirectory(),
    getMyIntroRequests(),
    prisma.achievementPointSummary.findUnique({
      where: { userId },
      select: { currentTier: true },
    }),
  ]);

  const allAlumni = alumni ?? [];
  const tier = summary?.currentTier ?? null;
  const introLimit = tier ? TIER_INTRO_LIMITS[tier] ?? 1 : 1;
  const sentCount = introData?.sent.length ?? 0;

  // Group by college
  const byCollege = allAlumni.reduce(
    (acc, a) => {
      const key = a.college ?? "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(a);
      return acc;
    },
    {} as Record<string, typeof allAlumni>
  );

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Alumni Network</p>
          <h1 className="page-title">Browse Alumni</h1>
          <p className="page-subtitle">
            {allAlumni.length} alumni · {Object.keys(byCollege).length} colleges
          </p>
        </div>
        <Link href="/alumni-network" className="button secondary small">← Alumni Hub</Link>
      </div>

      {/* Intro request limit indicator */}
      <div className="card" style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>Intro Request Limit</p>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {tier
              ? `${tier} tier: ${introLimit} requests · ${sentCount} sent · ${Math.max(0, introLimit - sentCount)} remaining`
              : "Earn a tier to unlock intro requests"}
          </p>
        </div>
        {introData && introData.received.length > 0 && (
          <div>
            <span className="pill" style={{ fontSize: "0.72rem", background: "#fef9c3", color: "#854d0e" }}>
              {introData.received.length} pending request{introData.received.length > 1 ? "s" : ""} to review
            </span>
          </div>
        )}
      </div>

      {allAlumni.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎓</p>
          <p>No alumni profiles available yet.</p>
        </div>
      ) : (
        Object.entries(byCollege)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([college, collegeAlumni]) => (
            <div key={college} style={{ marginBottom: "1.5rem" }}>
              <p style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                🎓 {college.toUpperCase()} ({collegeAlumni.length})
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.75rem" }}>
                {collegeAlumni.map((a) => (
                  <div key={a.id} className="card" style={{ padding: "0.875rem 1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{a.name}</p>
                        {a.yearStarted && (
                          <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Class of {a.yearStarted}</p>
                        )}
                        {a.chapterName && (
                          <p style={{ fontSize: "0.72rem", color: "var(--muted)" }}>YPP {a.chapterName}</p>
                        )}
                      </div>
                      {a.introStatus === "ACCEPTED" ? (
                        <span className="pill" style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534" }}>
                          Connected
                        </span>
                      ) : a.introStatus === "PENDING" ? (
                        <span className="pill" style={{ fontSize: "0.65rem" }}>Pending</span>
                      ) : null}
                    </div>
                    {a.bio && (
                      <p style={{ fontSize: "0.78rem", color: "var(--text)", lineHeight: 1.5, marginBottom: "0.5rem" }}>
                        {a.bio.slice(0, 120)}{a.bio.length > 120 ? "…" : ""}
                      </p>
                    )}
                    {!a.introStatus && sentCount < introLimit && (
                      <IntroRequestClient alumniId={a.id} alumniName={a.name} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
      )}

      {/* Pending requests to respond to */}
      {introData && introData.received.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "0.75rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
            Intro Requests to Review ({introData.received.length})
          </p>
          {introData.received.map((r) => (
            <div
              key={r.id}
              style={{ padding: "0.75rem 0", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "0.88rem" }}>{r.requesterName}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>{r.requesterRole}</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text)", fontStyle: "italic" }}>
                  &ldquo;{r.message.slice(0, 150)}&rdquo;
                </p>
              </div>
              <IntroRequestClient requestId={r.id} mode="respond" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
