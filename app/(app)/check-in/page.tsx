import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CheckInPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Community</p>
          <h1 className="page-title">Check-In</h1>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div className="card">
          <h3>Self Check-In</h3>
          <p style={{ marginTop: 8 }}>
            Enter the code provided by your instructor to check in to today's session.
          </p>

          <form action="/api/check-in/submit" method="POST" style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="code" style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
                Check-In Code
              </label>
              <input
                type="text"
                id="code"
                name="code"
                required
                placeholder="Enter 6-digit code"
                maxLength={6}
                style={{
                  width: "100%",
                  padding: 16,
                  border: "2px solid var(--border-color)",
                  borderRadius: 8,
                  fontSize: 24,
                  textAlign: "center",
                  letterSpacing: "0.5em",
                  fontFamily: "monospace",
                  textTransform: "uppercase"
                }}
              />
            </div>

            <button type="submit" className="button primary" style={{ width: "100%", padding: "16px" }}>
              Check In
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 20 }}>
          <h3>How It Works</h3>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>1️⃣</div>
              <div>
                <strong>Get the code</strong>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  Your instructor will display a 6-digit code on screen
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 24 }}>2️⃣</div>
              <div>
                <strong>Enter the code</strong>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  Type it in the box above
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ fontSize: 24 }}>3️⃣</div>
              <div>
                <strong>You're checked in!</strong>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  Attendance will be recorded automatically
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
