import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterInvites, getChapterReferralStats } from "@/lib/chapter-invite-actions";
import { InviteManager } from "./invite-manager";
import Link from "next/link";

export default async function ChapterInvitesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [invites, referralStats] = await Promise.all([
    getChapterInvites(),
    getChapterReferralStats(),
  ]);

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Invite Links</h1>
          <p className="subtitle">Create shareable links to grow your chapter</p>
        </div>
        <Link href="/chapter/settings" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
          ← Back to Settings
        </Link>
      </div>

      {/* Referral Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="kpi">{referralStats.totalInviteJoins}</div>
          <div className="kpi-label">Members via Invites</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{referralStats.activeInvites}</div>
          <div className="kpi-label">Active Links</div>
        </div>
        <div className="stat-card">
          <div className="kpi">{referralStats.totalInvites}</div>
          <div className="kpi-label">Total Links Created</div>
        </div>
      </div>

      {/* Top Performing Invites */}
      {referralStats.topInvites.length > 0 && referralStats.topInvites.some((i: { useCount: number }) => i.useCount > 0) && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px" }}>Top Performing Links</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {referralStats.topInvites
              .filter((i: { useCount: number }) => i.useCount > 0)
              .map((inv: { label: string; useCount: number; createdBy: string }, index: number) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "var(--bg)",
                    fontSize: 14,
                  }}
                >
                  <div>
                    <strong>{inv.label}</strong>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>
                      by {inv.createdBy}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--ypp-purple)" }}>
                    {inv.useCount} joins
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <InviteManager invites={invites} />
    </main>
  );
}
