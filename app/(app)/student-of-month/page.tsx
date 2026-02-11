import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/empty-state";

export default async function StudentOfMonthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const winners = await prisma.studentOfMonth.findMany({
    include: { student: { select: { name: true } } },
    orderBy: { month: "desc" },
    take: 12,
  });

  if (winners.length === 0) {
    return (
      <EmptyState
        icon="⭐"
        badge="Recognition"
        title="Student of the Month"
        description="Each month, one outstanding student per chapter is recognized for dedication, growth, and community spirit in their passion pursuits."
        addedBy="chapter leaders and admins"
        actionLabel="Go to Admin Panel"
        actionHref="/admin"
      />
    );
  }

  const current = winners[0];
  const past = winners.slice(1);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Recognition</p>
          <h1 className="page-title">Student of the Month</h1>
        </div>
      </div>

      {/* Current Winner */}
      <div className="card" style={{ marginBottom: 28, border: "2px solid var(--primary-color)" }}>
        <h2 style={{ marginBottom: 8 }}>{current.student.name}</h2>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16 }}>
          {new Date(current.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{current.nomination}</p>
        {current.achievements.length > 0 && (
          <ul style={{ marginLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {current.achievements.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Past Winners */}
      {past.length > 0 && (
        <>
          <h3 style={{ marginBottom: 16 }}>Past Winners</h3>
          <div className="grid three">
            {past.map((winner) => (
              <div key={winner.id} className="card" style={{ textAlign: "center" }}>
                <h4 style={{ marginBottom: 4 }}>{winner.student.name}</h4>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {new Date(winner.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  {winner.nomination.length > 100 ? winner.nomination.substring(0, 100) + "..." : winner.nomination}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
