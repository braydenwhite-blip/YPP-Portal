import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProgressSummaryStrip from "@/components/progress-summary-strip";
import CrossLinkSection from "@/components/cross-link-section";
import SmartSuggestionCard from "@/components/smart-suggestion";
import { getPageProgressSummary, getCrossLinks, getSmartSuggestions } from "@/lib/cross-links";

const CATEGORY_META: Record<string, { label: string; icon: string; how: string }> = {
  PURSUIT: {
    label: "Pursuit",
    icon: "🎯",
    how: "Awarded for consistent dedication to your passion — showing up, practicing, and putting in the hours week after week.",
  },
  BREAKTHROUGH: {
    label: "Breakthrough",
    icon: "💡",
    how: "Earned when you hit a major 'aha!' moment — a skill unlocked, a concept mastered, or a personal record broken.",
  },
  PERSISTENCE: {
    label: "Persistence",
    icon: "🔥",
    how: "Given to students who push through setbacks, keep going after failure, and refuse to quit when things get hard.",
  },
  IMPROVEMENT: {
    label: "Improvement",
    icon: "📈",
    how: "Celebrates measurable growth — instructors and mentors nominate students who've come the farthest from where they started.",
  },
  SHOWCASE: {
    label: "Showcase",
    icon: "🌟",
    how: "Recognizes students who share their work publicly — presenting at showcases, competitions, or in the community.",
  },
};

export default async function AwardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  const [progressSummary, crossLinks, suggestions] = await Promise.all([
    getPageProgressSummary(userId, "/awards").catch(() => ({ items: [] })),
    getCrossLinks(userId, "/awards").catch(() => ({ related: [], connections: [] })),
    getSmartSuggestions(userId, "/awards").catch(() => []),
  ]);

  const studentAwards = await prisma.studentAward.findMany({
    where: { studentId: userId },
    include: {
      award: {
        select: { name: true, description: true, category: true, icon: true, xpReward: true },
      },
    },
    orderBy: { awardedAt: "desc" },
  });

  const grouped: Record<string, typeof studentAwards> = {};
  for (const sa of studentAwards) {
    const cat = sa.award.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(sa);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Awards &amp; Achievements</h1>
          <p className="page-subtitle">
            {studentAwards.length > 0
              ? `You've earned ${studentAwards.length} award${studentAwards.length !== 1 ? "s" : ""}. Keep going.`
              : "No awards yet — here's what you can earn and how."}
          </p>
        </div>
      </div>

      <ProgressSummaryStrip data={progressSummary} />

      {studentAwards.length > 0 ? (
        <>
          {Object.entries(grouped).map(([category, awards]) => {
            const meta = CATEGORY_META[category] ?? { label: category, icon: "🏆", how: "" };
            return (
              <div key={category} style={{ marginBottom: 32 }}>
                <h2 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{meta.icon}</span> {meta.label}
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {awards.map((sa) => (
                    <div key={sa.id} className="card">
                      <div style={{ fontSize: 40, marginBottom: 12 }}>{sa.award.icon || meta.icon}</div>
                      <h3 style={{ marginBottom: 4 }}>{sa.award.name}</h3>
                      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                        {sa.reason}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "var(--text-secondary)" }}>
                        <span>
                          {new Date(sa.awardedAt).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {sa.award.xpReward > 0 && (
                          <span
                            className="pill"
                            style={{ backgroundColor: "var(--primary-color)", color: "white", border: "none" }}
                          >
                            +{sa.award.xpReward} XP
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 28, padding: "28px 32px" }}>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-secondary)" }}>
              Awards are nominated by your instructors, mentors, and chapter leaders. There are five
              categories — each recognizing a different kind of excellence. Once you earn one, it
              will appear here permanently.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {Object.entries(CATEGORY_META).map(([, meta]) => (
              <div key={meta.label} className="card">
                <div style={{ fontSize: 40, marginBottom: 12 }}>{meta.icon}</div>
                <h3 style={{ marginBottom: 8 }}>{meta.label} Award</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{meta.how}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <CrossLinkSection data={crossLinks} />
      <SmartSuggestionCard suggestions={suggestions} />
    </div>
  );
}
