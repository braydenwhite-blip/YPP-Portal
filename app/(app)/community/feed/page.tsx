import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function CommunityFeedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/public/login");
  }

  // Get recent peer recognitions
  const recognitions = await prisma.peerRecognition.findMany({
    where: { isPublic: true },
    include: {
      fromUser: true,
      toUser: true
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  // Get user's recognitions received
  const userRecognitions = await prisma.peerRecognition.findMany({
    where: { toUserId: session.user.id },
    include: { fromUser: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Recognition Feed</h1>
        </div>
        <Link href="/community/recognize" className="button primary">
          Give Recognition
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 28 }}>
        <div className="card">
          <h3>Celebrate Each Other</h3>
          <p>
            Give shoutouts to classmates and instructors who've helped you or done something awesome!
            Recognition appears in the community feed for everyone to see.
          </p>
        </div>
        <div className="card">
          <div className="grid two">
            <div>
              <div className="kpi">{userRecognitions.length}</div>
              <div className="kpi-label">You Received</div>
            </div>
            <div>
              <div className="kpi">{recognitions.length}</div>
              <div className="kpi-label">Total Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Your recognitions */}
      {userRecognitions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div className="section-title">Your Recognition</div>
          <div className="grid two">
            {userRecognitions.slice(0, 4).map(recognition => (
              <div
                key={recognition.id}
                className="card"
                style={{ background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, transparent 100%)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 32 }}>🎉</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{recognition.fromUser.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(recognition.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <p style={{ fontStyle: "italic" }}>"{recognition.message}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Community feed */}
      <div>
        <div className="section-title">Community Feed</div>
        {recognitions.length === 0 ? (
          <div className="card">
            <p style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              No recognitions yet. Be the first to give a shoutout!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {recognitions.map(recognition => (
              <div key={recognition.id} className="card">
                <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
                  <div style={{ fontSize: 28 }}>🌟</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>{recognition.fromUser.name}</strong>
                      {" gave recognition to "}
                      <strong>{recognition.toUser.name}</strong>
                    </div>
                    <p style={{
                      padding: 12,
                      backgroundColor: "var(--accent-bg)",
                      borderRadius: 6,
                      fontStyle: "italic"
                    }}>
                      "{recognition.message}"
                    </p>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(recognition.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
