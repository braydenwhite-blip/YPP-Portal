import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function XPProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get XP profile
  const xpProfile = await prisma.studentXP.findUnique({
    where: { studentId: session.user.id }
  });

  // Get recent XP transactions
  const transactions = await prisma.xPTransaction.findMany({
    where: { studentId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  // Get earned badges
  const badges = await prisma.studentBadge.findMany({
    where: { studentId: session.user.id },
    include: { badge: true },
    orderBy: { earnedAt: 'desc' }
  });

  const totalXP = xpProfile?.totalXP || 0;
  const currentLevel = xpProfile?.currentLevel || 1;
  const xpToNext = xpProfile?.xpToNextLevel || 100;
  const xpProgress = ((totalXP % xpToNext) / xpToNext) * 100;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Profile</p>
          <h1 className="page-title">My Progress</h1>
        </div>
      </div>

      {/* Level Card */}
      <div className="card" style={{ marginBottom: 28, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 72 }}>⭐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Your Level</div>
            <div style={{ fontSize: 48, fontWeight: 700, marginTop: 4 }}>
              {currentLevel}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                {totalXP % xpToNext} / {xpToNext} XP to next level
              </div>
              <div style={{
                height: 8,
                backgroundColor: "rgba(255,255,255,0.3)",
                borderRadius: 4,
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${xpProgress}%`,
                  backgroundColor: "white",
                  borderRadius: 4
                }} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{totalXP}</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Total XP</div>
          </div>
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div className="section-title">Your Badges</div>
          <div className="grid four">
            {badges.map((studentBadge) => (
              <div key={studentBadge.id} className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{studentBadge.badge.icon}</div>
                <h4 style={{ fontSize: 14 }}>{studentBadge.badge.name}</h4>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {studentBadge.badge.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <div className="section-title">Recent Activity</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {transactions.length === 0 ? (
            <div className="card">
              <p style={{ color: "var(--text-secondary)" }}>
                Start exploring passions to earn XP!
              </p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{tx.reason}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 20, 
                    fontWeight: 700,
                    color: tx.amount > 0 ? "var(--success-color)" : "var(--error-color)"
                  }}>
                    +{tx.amount} XP
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
