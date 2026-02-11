import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GiveRecognitionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Get all users except current user
  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id }
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true
    },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">
            <Link href="/community/feed" style={{ color: "inherit", textDecoration: "none" }}>
              Recognition Feed
            </Link>
          </p>
          <h1 className="page-title">Give Recognition</h1>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div className="card">
          <form action="/api/recognition/create" method="POST">
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="toUserId" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Who do you want to recognize? *
              </label>
              <select
                id="toUserId"
                name="toUserId"
                required
                style={{
                  width: "100%",
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  backgroundColor: "var(--bg-primary)"
                }}
              >
                <option value="">Select a person...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.primaryRole})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label htmlFor="message" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Your Message *
              </label>
              <textarea
                id="message"
                name="message"
                required
                placeholder="What did they do that was awesome? Be specific and genuine!"
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical"
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  name="isPublic"
                  value="true"
                  defaultChecked
                  style={{ marginRight: 8, width: 18, height: 18, cursor: "pointer" }}
                />
                <span>Share publicly on the community feed</span>
              </label>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, marginLeft: 26 }}>
                Uncheck to send a private recognition
              </p>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" className="button primary" style={{ flex: 1 }}>
                Send Recognition
              </button>
              <Link href="/community/feed" className="button secondary" style={{ flex: 1 }}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
