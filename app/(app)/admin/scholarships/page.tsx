import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";

const PLANNED_FEATURES = [
  {
    icon: "📋",
    title: "Scholarship Listings",
    desc: "Create and publish scholarship opportunities with eligibility criteria, award amounts, and application deadlines.",
  },
  {
    icon: "📝",
    title: "Student Applications",
    desc: "Students apply through a guided form — including essays, recommendations, passion portfolio links, and supporting materials.",
  },
  {
    icon: "👥",
    title: "Review Committee",
    desc: "Assign reviewers to score applications with a structured rubric. Scores aggregate automatically and flag top candidates.",
  },
  {
    icon: "🗳️",
    title: "Committee Vote",
    desc: "Facilitate structured discussions and voting across committee members before final decisions are made.",
  },
  {
    icon: "🏆",
    title: "Award & Notification",
    desc: "Award the scholarship, send automated notifications to winners and applicants, and record it in the student's profile.",
  },
  {
    icon: "📊",
    title: "Disbursement Tracking",
    desc: "Track whether scholarship funds have been sent and confirmed — with audit trail for compliance.",
  },
];

const PLANNED_WORKFLOW = [
  { step: "1", label: "Admin creates scholarship", color: "#6366f1" },
  { step: "2", label: "Students apply", color: "#8b3fe8" },
  { step: "3", label: "Committee reviews & scores", color: "#b47fff" },
  { step: "4", label: "Committee votes", color: "#c4b5fd" },
  { step: "5", label: "Award granted", color: "#10b981" },
  { step: "6", label: "Disbursement tracked", color: "#059669" },
];

export default async function ScholarshipManagementPage() {
  const session = await getSession();
  if (!session?.user?.id || session.user.primaryRole !== "ADMIN") {
    redirect("/");
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Scholarship Portal Management</h1>
          <p className="page-subtitle">
            Full scholarship management is coming — here&apos;s what&apos;s planned and what you can use today.
          </p>
        </div>
      </div>

      {/* Pending notice */}
      <div
        className="card"
        style={{
          marginBottom: 32,
          padding: "20px 24px",
          borderLeft: "4px solid #f59e0b",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🚧</span>
          <div>
            <strong>Scholarship models are pending</strong>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4, marginBottom: 0 }}>
              The Prisma schema models for scholarships and applications have not been added yet.
              This page will go live once the database migration is complete. In the meantime, you
              can use the tools below to recognize students and manage opportunities.
            </p>
          </div>
        </div>
      </div>

      {/* Planned workflow */}
      <h2 style={{ marginBottom: 16 }}>Planned Workflow</h2>
      <div style={{ display: "flex", gap: 0, marginBottom: 36, overflowX: "auto", paddingBottom: 8 }}>
        {PLANNED_WORKFLOW.map((step, i) => (
          <div key={step.step} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <div
              style={{
                backgroundColor: step.color,
                color: "white",
                borderRadius: 8,
                padding: "12px 16px",
                textAlign: "center",
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{step.step}</div>
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>{step.label}</div>
            </div>
            {i < PLANNED_WORKFLOW.length - 1 && (
              <div style={{ fontSize: 18, color: "var(--text-secondary)", margin: "0 4px" }}>→</div>
            )}
          </div>
        ))}
      </div>

      {/* Planned features */}
      <h2 style={{ marginBottom: 16 }}>What Will Be Included</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20, marginBottom: 36 }}>
        {PLANNED_FEATURES.map((feature) => (
          <div key={feature.title} className="card">
            <div style={{ fontSize: 36, marginBottom: 12 }}>{feature.icon}</div>
            <h3 style={{ marginBottom: 8 }}>{feature.title}</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Tools available now */}
      <h2 style={{ marginBottom: 16 }}>Available Tools Today</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {[
          { label: "Awards & Recognition", href: "/admin/recognition", desc: "Nominate students for achievement awards in 5 categories." },
          { label: "Opportunities", href: "/admin/opportunities", desc: "Post internships, positions, and service opportunities for students." },
          { label: "Wall of Fame", href: "/admin/wall-of-fame", desc: "Feature extraordinary student achievements prominently in the portal." },
          { label: "Student of the Month", href: "/admin/student-of-month", desc: "Recognize one outstanding student per chapter each month." },
        ].map((tool) => (
          <Link key={tool.href} href={tool.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ cursor: "pointer", height: "100%" }}>
              <h4 style={{ marginBottom: 6 }}>{tool.label}</h4>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{tool.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
