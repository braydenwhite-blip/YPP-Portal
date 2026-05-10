import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  sourceTypeLabel,
  submissionStatusLabel,
  submissionStatusTone,
} from "@/lib/workshop-proposal-constants";
import type {
  WorkshopProposalSourceType,
  WorkshopProposalSubmissionStatus,
} from "@prisma/client";
import { ReviewQueueFilters } from "./filters";

const COLUMNS: {
  status: WorkshopProposalSubmissionStatus;
  label: string;
  dotColor: string;
}[] = [
  { status: "SUBMITTED",         label: "New submissions",   dotColor: "#6366f1" },
  { status: "IN_REVIEW",         label: "In review",         dotColor: "#0ea5e9" },
  { status: "CHANGES_REQUESTED", label: "Changes requested", dotColor: "#f59e0b" },
  { status: "APPROVED",          label: "Approved",          dotColor: "#16a34a" },
  { status: "REJECTED",          label: "Rejected",          dotColor: "#71717a" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function pickString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const VALID_STATUS_FILTER = new Set<WorkshopProposalSubmissionStatus>([
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
]);
const VALID_SOURCE_FILTER = new Set<WorkshopProposalSourceType>([
  "CUSTOM_DESIGN",
  "TEMPLATE_SELECTION",
]);

export default async function WorkshopReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isChapterLead = roles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isChapterLead) {
    redirect("/");
  }

  const sp = (await searchParams) ?? {};
  const search = pickString(sp.q).trim().toLowerCase();
  const statusParam = pickString(sp.status).trim().toUpperCase();
  const sourceParam = pickString(sp.source).trim().toUpperCase();
  const statusFilter = VALID_STATUS_FILTER.has(
    statusParam as WorkshopProposalSubmissionStatus
  )
    ? (statusParam as WorkshopProposalSubmissionStatus)
    : "";
  const sourceFilter = VALID_SOURCE_FILTER.has(
    sourceParam as WorkshopProposalSourceType
  )
    ? (sourceParam as WorkshopProposalSourceType)
    : "";

  // Chapter scope for chapter leads. Mirrors the
  // assertReviewerCanReviewSubmission rule in workshop-proposal-actions.ts:
  // chapter leads see only authors in their own chapter; admins see all.
  // We fail closed (empty queue) if a chapter lead has no chapter assigned,
  // so the gate never silently widens.
  const reviewerChapterId = isAdmin
    ? null
    : (await withPrismaFallback(
        "workshop-reviews:reviewer-chapter",
        () =>
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: { chapterId: true },
          }),
        null
      ))?.chapterId ?? null;

  // Hide DRAFT submissions — those are still being authored.
  const submissions = await withPrismaFallback(
    "workshop-reviews:list",
    () =>
      prisma.workshopProposalSubmission.findMany({
        where: {
          status: { not: "DRAFT" },
          ...(isAdmin
            ? {}
            : reviewerChapterId
              ? { author: { chapterId: reviewerChapterId } }
              : { id: "__no_match__" /* fail closed */ }),
        },
        orderBy: [{ submittedAt: "asc" }, { updatedAt: "desc" }],
        include: {
          author: { select: { id: true, name: true, email: true, chapterId: true } },
          template: { select: { id: true, title: true } },
        },
      }),
    []
  );

  // Counts come from the unfiltered set so the KPI tiles reflect the queue
  // as a whole, not the current view.
  const counts = {
    total: submissions.length,
    awaitingReview: submissions.filter(
      (s) => s.status === "SUBMITTED" || s.status === "IN_REVIEW"
    ).length,
    decided: submissions.filter(
      (s) => s.status === "APPROVED" || s.status === "REJECTED"
    ).length,
    changesRequested: submissions.filter(
      (s) => s.status === "CHANGES_REQUESTED"
    ).length,
  };

  // Apply the user's filters in-memory. Volumes here are small (per-chapter
  // or admin-wide queue of proposals) so a Prisma round-trip per filter
  // change is unnecessary; this also keeps the column counts in step with
  // the search box without a second query.
  const visible = submissions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (sourceFilter && s.sourceType !== sourceFilter) return false;
    if (search) {
      const haystack = [
        s.author.name ?? "",
        s.author.email ?? "",
        s.template?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const visibleColumns = statusFilter
    ? COLUMNS.filter((c) => c.status === statusFilter)
    : COLUMNS;

  const grouped = new Map<WorkshopProposalSubmissionStatus, typeof submissions>();
  for (const col of visibleColumns) grouped.set(col.status, []);
  for (const s of visible) {
    const list = grouped.get(s.status);
    if (list) list.push(s);
  }

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Reviewer queue</p>
          <h1 className="page-title">Workshop Reviews</h1>
          <p className="page-subtitle">
            Workshop proposals from Summer Workshop Instructor applicants.
            Open a submission to score it across clarity, engagement,
            feasibility, age-appropriateness, preparedness, and YPP-values
            alignment.
          </p>
        </div>
      </div>

      <div className="grid four" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{counts.total}</div>
          <div className="kpi-label">Active submissions</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.awaitingReview}</div>
          <div className="kpi-label">Awaiting review</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.changesRequested}</div>
          <div className="kpi-label">Changes requested</div>
        </div>
        <div className="card">
          <div className="kpi">{counts.decided}</div>
          <div className="kpi-label">Approved or rejected</div>
        </div>
      </div>

      <ReviewQueueFilters
        currentSearch={search}
        currentStatus={statusFilter}
        currentSource={sourceFilter}
        totalVisible={visible.length}
        totalAll={submissions.length}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {visibleColumns.map((col) => {
          const list = grouped.get(col.status) ?? [];
          return (
            <div key={col.status}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: col.dotColor,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {col.label} ({list.length})
                </span>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {list.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                    {col.status === "SUBMITTED"
                      ? "Inbox is empty."
                      : col.status === "IN_REVIEW"
                        ? "No reviews open right now."
                        : col.status === "CHANGES_REQUESTED"
                          ? "Nothing waiting for the applicant."
                          : "Nothing here yet."}
                  </p>
                ) : (
                  list.map((s) => (
                    <Link
                      key={s.id}
                      href={`/admin/workshop-reviews/${s.id}`}
                      className="card"
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                      }}
                    >
                      <p style={{ margin: "0 0 2px", fontWeight: 600 }}>
                        {s.author.name}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        {s.author.email}
                      </p>
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: 12,
                          color: "var(--muted)",
                        }}
                      >
                        {sourceTypeLabel(s.sourceType)}
                        {s.template ? ` · ${s.template.title}` : ""}
                      </p>
                      {(() => {
                        const tone = submissionStatusTone(s.status);
                        const toneStyle: Record<typeof tone, { bg: string; fg: string }> = {
                          neutral: { bg: "var(--surface-alt, #f3f4f6)", fg: "var(--ink, #111827)" },
                          info:    { bg: "#eff6ff", fg: "#1d4ed8" },
                          warn:    { bg: "#fffbeb", fg: "#92400e" },
                          success: { bg: "#dcfce7", fg: "#166534" },
                          danger:  { bg: "#fef2f2", fg: "#991b1b" },
                        };
                        const palette = toneStyle[tone];
                        return (
                          <span
                            className="pill pill-small"
                            style={{
                              marginTop: 8,
                              display: "inline-block",
                              background: palette.bg,
                              color: palette.fg,
                              border: "1px solid currentColor",
                            }}
                          >
                            {submissionStatusLabel(s.status)}
                          </span>
                        );
                      })()}
                      {s.submittedAt ? (
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: 11,
                            color: "var(--muted)",
                          }}
                        >
                          Submitted{" "}
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
