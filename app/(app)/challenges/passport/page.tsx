import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPassionPassports } from "@/lib/challenge-gamification-actions";
import Link from "next/link";
import { CreatePassportForm, EarnStampForm } from "./client";

export default async function PassionPassportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { passports, subAreas } = await getPassionPassports();
  const allPassionAreas = Object.keys(subAreas);
  const existingAreas = passports.map((p) => p.passionArea);
  const availableAreas = allPassionAreas.filter((a) => !existingAreas.includes(a));

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/challenges" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Challenges
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>Passion Passport</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Explore sub-areas within each passion and collect stamps for trying new things!
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="card" style={{ marginBottom: 24, background: "var(--ypp-purple-50)", borderLeft: "4px solid var(--ypp-purple)" }}>
        <div style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>How It Works</div>
        <p style={{ marginTop: 4, fontSize: 14, color: "var(--text-secondary)" }}>
          Each passion area has 8 sub-areas to explore. Earn stamps by trying a sub-area for the first time,
          taking a class, completing a project, or logging practice hours. Earn <strong>15 XP</strong> per stamp!
        </p>
      </div>

      {/* Create New Passport */}
      {availableAreas.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <CreatePassportForm availableAreas={availableAreas} />
        </div>
      )}

      {/* Passports Grid */}
      {passports.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {passports.map((passport) => {
            const areas = subAreas[passport.passionArea] || [];
            const earnedSubAreas = passport.stamps.map((s) => s.subArea);
            const completion = Math.round(passport.completionPercentage);

            const passportColors: Record<string, string> = {
              Art: "#ef4444",
              Music: "#3b82f6",
              Writing: "#8b5cf6",
              Dance: "#ec4899",
              Theater: "#f59e0b",
              Film: "#6366f1",
              Coding: "#10b981",
              Science: "#06b6d4",
            };
            const color = passportColors[passport.passionArea] || "var(--ypp-purple)";

            return (
              <div key={passport.id} className="card" style={{ borderTop: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color }}>{passport.passionArea} Passport</h3>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {passport.totalStamps} / {areas.length} stamps collected
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color }}>{completion}%</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>complete</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ width: "100%", height: 8, background: "var(--gray-200)", borderRadius: 4, marginBottom: 16 }}>
                  <div style={{ width: `${completion}%`, height: "100%", background: color, borderRadius: 4 }} />
                </div>

                {/* Stamp Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 }}>
                  {areas.map((area) => {
                    const earned = earnedSubAreas.includes(area);
                    const stamp = passport.stamps.find((s) => s.subArea === area);

                    return (
                      <div
                        key={area}
                        style={{
                          padding: 12,
                          borderRadius: "var(--radius-md)",
                          background: earned ? `${color}10` : "var(--surface-alt)",
                          border: earned ? `2px solid ${color}` : "2px dashed var(--gray-300)",
                          textAlign: "center",
                          position: "relative",
                        }}
                      >
                        <div style={{
                          fontSize: 24,
                          marginBottom: 4,
                        }}>
                          {earned ? (
                            <span style={{ filter: "none" }}>&#9733;</span>
                          ) : (
                            <span style={{ opacity: 0.3 }}>&#9734;</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: earned ? 600 : 400, color: earned ? color : "var(--text-secondary)" }}>
                          {area}
                        </div>
                        {stamp && (
                          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                            {new Date(stamp.earnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Earn Stamp Form */}
                {areas.filter((a) => !earnedSubAreas.includes(a)).length > 0 && (
                  <EarnStampForm
                    passportId={passport.id}
                    availableSubAreas={areas.filter((a) => !earnedSubAreas.includes(a))}
                  />
                )}

                {completion === 100 && (
                  <div style={{ padding: 12, background: "#dcfce7", borderRadius: "var(--radius-md)", textAlign: "center" }}>
                    <div style={{ fontWeight: 700, color: "#16a34a" }}>Passport Complete!</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      You&apos;ve explored every sub-area of {passport.passionArea}. Amazing!
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3>No Passports Yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Create a passport above to start collecting stamps!
          </p>
        </div>
      )}
    </div>
  );
}
