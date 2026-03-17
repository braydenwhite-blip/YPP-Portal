"use client";

import Link from "next/link";

interface CompletionScreenProps {
  savedPlans: Array<{ planId: string; title: string; totalMinutes: number }>;
  curriculumId: string | null;
  curriculumTitle: string | null;
}

export function CompletionScreen({
  savedPlans,
  curriculumId,
  curriculumTitle,
}: CompletionScreenProps) {
  const totalMinutes = savedPlans.reduce((s, p) => s + p.totalMinutes, 0);

  return (
    <div className="os-completion">
      <div className="os-completion-icon">🎉</div>

      <div>
        <h1 className="os-completion-heading">
          {savedPlans.length === 0
            ? "Studio Complete"
            : `${savedPlans.length} ${savedPlans.length === 1 ? "Plan" : "Plans"} Ready`}
        </h1>
        <p className="os-completion-sub">
          {savedPlans.length === 0
            ? "You've completed the Lesson Design Studio. You can come back anytime to build your lesson plans."
            : `You've built ${savedPlans.length} lesson plan${savedPlans.length === 1 ? "" : "s"} totaling ${totalMinutes} minutes of instruction time. They're saved and ready to use.`}
        </p>
      </div>

      {savedPlans.length > 0 && (
        <div className="os-completion-stats">
          <div className="os-completion-stat">
            <div className="os-completion-stat-num">{savedPlans.length}</div>
            <div className="os-completion-stat-label">Plans Built</div>
          </div>
          <div className="os-completion-stat">
            <div className="os-completion-stat-num">{totalMinutes}</div>
            <div className="os-completion-stat-label">Total Minutes</div>
          </div>
        </div>
      )}

      {savedPlans.length > 0 && (
        <div className="os-saved-plans-grid">
          {savedPlans.map((p) => (
            <div key={p.planId} className="os-saved-plan-card saved">
              <div className="os-saved-plan-name">{p.title}</div>
              <div className="os-saved-plan-meta">{p.totalMinutes} min</div>
            </div>
          ))}
        </div>
      )}

      <div className="os-completion-actions">
        <Link href="/lesson-plans" className="os-btn os-btn-primary">
          View All Lesson Plans →
        </Link>
        {curriculumId && (
          <Link
            href="/instructor/curriculum-builder"
            className="os-btn os-btn-secondary"
          >
            Back to Curriculum Builder
          </Link>
        )}
        <Link href="/instructor/workspace" className="os-btn os-btn-secondary">
          Go to Workspace
        </Link>
      </div>
    </div>
  );
}
