import Link from "next/link";
import { notFound } from "next/navigation";

import { requireCPO } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { getMatrixLabel } from "@/lib/matrix";
import { loadPeopleDashboard } from "@/lib/people-strategy/people-dashboard";
import {
  QuarterlyReviewForm,
  type LatestQuarterlyReview,
} from "@/components/people-strategy/quarterly-review-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · CPO People Review" };

export default async function PersonReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isPeopleDashboardEnabled()) notFound();

  const viewer = await requireCPO().catch(() => null);
  if (!viewer) notFound();

  const { id } = await params;

  // Reuse the same compiled rows the table uses, then pick this member out.
  const rows = await loadPeopleDashboard();
  const row = rows.find((r) => r.id === id);
  if (!row) notFound();

  // The latest review, including the fields the form needs but the table row
  // does not carry (notes + createdAt).
  const review = await prisma.quarterlyReview.findFirst({
    where: { userId: id },
    orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
  });

  const latestReview: LatestQuarterlyReview | null = review
    ? {
        quarter: review.quarter,
        performanceRating: review.performanceRating,
        potentialRating: review.potentialRating,
        decision: review.decision,
        notes: review.notes,
        successionFlag: review.successionFlag,
        matrixLabel: getMatrixLabel(review.performanceRating, review.potentialRating),
        createdAt: review.createdAt.toISOString(),
      }
    : null;

  return (
    <div className="page-shell" style={{ maxWidth: 760 }}>
      <Link href="/people" className="button outline small" style={{ alignSelf: "flex-start" }}>
        ← Back to People Dashboard
      </Link>

      <div className="topbar" style={{ marginTop: 12 }}>
        <p className="badge">Action Tracker · CPO View</p>
        <h1 className="page-title" style={{ marginTop: 8 }}>
          {row.name || row.email}
        </h1>
        <p className="page-subtitle">
          {row.role ?? "—"}
          {row.mentorName ? ` · Mentor: ${row.mentorName}` : ""}
          {row.departments.length > 0 ? ` · ${row.departments.join(", ")}` : ""}
        </p>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>Lead actions</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{row.leadActions.length}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>Executing actions</p>
          <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{row.executingActions.length}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>Trend</p>
          <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>{row.trend}</p>
        </div>
        {row.successor ? (
          <div>
            <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>Succession</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#6d28d9" }}>★ Successor</p>
          </div>
        ) : null}
        {row.workloadWarning ? (
          <div>
            <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", color: "#64748b" }}>Workload</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#b45309" }}>⚠ {row.workloadWarning}</p>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 16 }}>
        <QuarterlyReviewForm userId={id} latestReview={latestReview} canSubmit />
      </div>
    </div>
  );
}
