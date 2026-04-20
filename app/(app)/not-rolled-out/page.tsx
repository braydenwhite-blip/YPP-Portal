import Link from "next/link";

export default function NotRolledOutPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Coming Soon</p>
          <h1 className="page-title">Feature Not Available</h1>
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: "60px 32px" }}>
        <div style={{ fontSize: 72, marginBottom: 20 }}>🚧</div>
        <h2 style={{ marginBottom: 12 }}>This feature has not yet been rolled out</h2>
        <p style={{
          color: "var(--text-secondary)",
          maxWidth: 480,
          margin: "0 auto 24px",
          lineHeight: 1.6,
        }}>
          We&apos;re working hard to bring this to you. In the meantime, check out the hiring features that are live today.
        </p>
        <Link href="/positions" className="button primary">
          View Open Positions
        </Link>
      </div>
    </div>
  );
}
