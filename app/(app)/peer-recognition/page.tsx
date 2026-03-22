import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getKudosFeed, getKudosRecipients } from "@/lib/peer-recognition-actions";
import KudosFeedClient from "./kudos-feed-client";

export const metadata = { title: "Peer Recognition — YPP" };

const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  HELPFULNESS: { label: "Helpfulness", emoji: "🤝", color: "#0ea5e9" },
  LEADERSHIP: { label: "Leadership", emoji: "🌟", color: "#7c3aed" },
  CREATIVITY: { label: "Creativity", emoji: "🎨", color: "#ec4899" },
  ABOVE_AND_BEYOND: { label: "Above & Beyond", emoji: "🚀", color: "#f59e0b" },
  TEAMWORK: { label: "Teamwork", emoji: "👥", color: "#10b981" },
  PROBLEM_SOLVING: { label: "Problem Solving", emoji: "🧠", color: "#3b82f6" },
};

export default async function PeerRecognitionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [feed, recipients] = await Promise.all([getKudosFeed(), getKudosRecipients()]);

  const currentUserId = session.user.id as string;

  return (
    <div>
      <div className="topbar" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Peer Recognition</h1>
          <p className="page-subtitle">Celebrate your teammates&apos; contributions</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
        {/* Feed */}
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "1rem", color: "var(--muted)" }}>
            RECENT SHOUT-OUTS
          </p>
          {!feed || feed.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🎉</p>
              <p>No kudos yet. Be the first to recognize a teammate!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {feed.map((k) => {
                const cfg = CATEGORY_CONFIG[k.category];
                return (
                  <div
                    key={k.id}
                    className="card"
                    style={{ borderLeft: `4px solid ${cfg?.color ?? "var(--border)"}`, padding: "1rem 1.25rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontSize: "1.25rem" }}>{cfg?.emoji ?? "👏"}</span>
                        <div>
                          <span style={{ fontWeight: 700 }}>{k.receiver.name}</span>
                          <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>
                            from {k.giver.name}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          className="pill"
                          style={{ fontSize: "0.7rem", background: `${cfg?.color}18`, color: cfg?.color }}
                        >
                          {cfg?.label ?? k.category}
                        </span>
                        {k.giver.id === currentUserId && (
                          <KudosFeedClient kudosId={k.id} mode="delete-button" />
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text)" }}>
                      &ldquo;{k.message}&rdquo;
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.4rem" }}>
                      {new Date(k.createdAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Send Kudos Panel */}
        <div>
          <div className="card">
            <p style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
              Send Kudos
            </p>
            <KudosFeedClient recipients={recipients ?? []} mode="send-form" categoryConfig={CATEGORY_CONFIG} />
          </div>

          {/* Category Legend */}
          <div className="card" style={{ marginTop: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.75rem" }}>Categories</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.82rem" }}>
                  <span>{cfg.emoji}</span>
                  <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
