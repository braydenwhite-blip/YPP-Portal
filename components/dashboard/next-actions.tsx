import Link from "next/link";
import type { DashboardNextAction } from "@/lib/dashboard/types";

type ActionTone = "urgent" | "warning" | "info" | "accent";

function toneFromUrgency(urgency: DashboardNextAction["urgency"]): ActionTone {
  if (urgency === "high") return "urgent";
  if (urgency === "medium") return "warning";
  if (urgency === "low") return "accent";
  return "info";
}

function inferIcon(action: DashboardNextAction, index: number): string {
  const t = `${action.title} ${action.detail}`.toLowerCase();
  if (t.includes("train") || t.includes("readiness")) return "🎓";
  if (t.includes("hire") || t.includes("interview") || t.includes("application")) return "📋";
  if (t.includes("parent") || t.includes("approv")) return "💜";
  if (t.includes("waitlist") || t.includes("queue")) return "⏱️";
  if (t.includes("pathway") || t.includes("step")) return "🗺️";
  if (t.includes("challenge") || t.includes("streak")) return "🏆";
  if (t.includes("class") || t.includes("enroll") || t.includes("curriculum")) return "📚";
  if (t.includes("incubator") || t.includes("project")) return "🛠️";
  if (t.includes("health") || t.includes("clear") || t.includes("healthy")) return "✨";
  const fallbacks = ["📌", "📋", "💼", "🎯"];
  return fallbacks[index % fallbacks.length];
}

export default function NextActions({
  actions,
}: {
  actions: DashboardNextAction[];
}) {
  if (actions.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="dashboard-section-head">
        <h3 className="dashboard-section-kicker" style={{ margin: 0 }}>
          Next actions
        </h3>
      </div>
      <div className="dashboard-next-actions">
        {actions.map((action, index) => {
          const tone = toneFromUrgency(action.urgency);
          return (
            <Link key={action.id} href={action.href} className="dashboard-action-link">
              <span className={`dashboard-action-stripe tone-${tone}`} aria-hidden />
              <div className="dashboard-action-body">
                <span className="dashboard-action-icon" aria-hidden>
                  {inferIcon(action, index)}
                </span>
                <div className="dashboard-action-text">
                  <p className="dashboard-action-title">{action.title}</p>
                  <p className="dashboard-action-detail">{action.detail}</p>
                  <div className="dashboard-action-meta">
                    {tone === "urgent" && (
                      <span className="dashboard-action-pill pill-urgent">High priority</span>
                    )}
                    {tone === "warning" && (
                      <span className="dashboard-action-pill pill-warning">Needs attention</span>
                    )}
                    {action.ctaLabel && (
                      <span className="dashboard-action-pill pill-cta">{action.ctaLabel}</span>
                    )}
                  </div>
                </div>
                <span className="dashboard-action-chevron" aria-hidden>
                  ›
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
