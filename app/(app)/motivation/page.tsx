import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const CATEGORY_META: Record<string, { label: string; icon: string; description: string }> = {
  STUCK: {
    label: "Feeling Stuck",
    icon: "🧱",
    description: "When progress feels frozen and you don't know where to turn next.",
  },
  FRUSTRATED: {
    label: "Feeling Frustrated",
    icon: "😤",
    description: "When you're working hard but not seeing the results you expected.",
  },
  DOUBTFUL: {
    label: "Self-Doubt",
    icon: "🤔",
    description: "When you're questioning whether you belong or whether you're good enough.",
  },
  BURNOUT: {
    label: "Burnout",
    icon: "🪫",
    description: "When you're exhausted and your passion feels more like a burden than a joy.",
  },
  GENERAL: {
    label: "General Support",
    icon: "💙",
    description: "Words of encouragement for any moment — good days and hard ones alike.",
  },
};

export default async function MotivationBoostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const boosts = await prisma.motivationBoost.findMany({
    where: { isActive: true },
    orderBy: { useCount: "desc" },
  });

  const grouped: Record<string, typeof boosts> = {};
  for (const boost of boosts) {
    const cat = boost.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(boost);
  }

  const hasBoosts = boosts.length > 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Support</p>
          <h1 className="page-title">Motivation Boost</h1>
          <p className="page-subtitle">
            Words from mentors who have walked this path — for when you need a reminder that you can do this.
          </p>
        </div>
      </div>

      {hasBoosts ? (
        <>
          {Object.entries(CATEGORY_META).map(([category, meta]) => {
            const categoryBoosts = grouped[category] ?? [];
            if (categoryBoosts.length === 0) return null;
            return (
              <div key={category} style={{ marginBottom: 36 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{meta.icon}</span>
                  <h2 style={{ margin: 0 }}>{meta.label}</h2>
                </div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>{meta.description}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {categoryBoosts.map((boost) => (
                    <div key={boost.id} className="card" style={{ borderLeft: "4px solid var(--primary-color)" }}>
                      <p style={{ fontSize: 16, lineHeight: 1.7, fontStyle: "italic", marginBottom: boost.author ? 12 : 0 }}>
                        &ldquo;{boost.message}&rdquo;
                      </p>
                      {boost.author && (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                          — {boost.author}
                        </p>
                      )}
                      {boost.videoUrl && (
                        <a
                          href={boost.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button"
                          style={{ display: "inline-block", marginTop: 12, fontSize: 13 }}
                        >
                          Watch video message
                        </a>
                      )}
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
              Mentors and admins share motivation boosts here — real messages from people who have
              pursued passions, faced setbacks, and kept going. Check back as your chapter grows and
              your mentors contribute their perspectives.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {Object.entries(CATEGORY_META).map(([, meta]) => (
              <div key={meta.label} className="card">
                <div style={{ fontSize: 36, marginBottom: 12 }}>{meta.icon}</div>
                <h3 style={{ marginBottom: 8 }}>{meta.label}</h3>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{meta.description}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
