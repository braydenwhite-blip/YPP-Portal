import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  sourceTypeLabel,
  submissionStatusLabel,
  workshopStatusPalette,
} from "@/lib/workshop-proposal-constants";
import type {
  WorkshopProposalSourceType,
  WorkshopProposalSubmissionStatus,
} from "@prisma/client";
import { ReviewQueueFilters } from "./filters";

const COLUMNS: {
  status: WorkshopProposalSubmissionStatus;
  label: string;
}[] = [
  { status: "SUBMITTED",         label: "New submissions" },
  { status: "IN_REVIEW",         label: "In review" },
  { status: "CHANGES_REQUESTED", label: "Changes requested" },
  { status: "APPROVED",          label: "Approved" },
  { status: "REJECTED",          label: "Rejected" },
];

/**
 * Whole days a submission has been waiting in the reviewer queue. Returns
 * null when there's no submit timestamp (legacy rows).
 */
function queueWaitDays(submittedAt: Date | null): number | null {
  if (!submittedAt) return null;
  const ms = Date.now() - new Date(submittedAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Traffic-light tone for queue wait time: green within target, yellow as it
 * slips, red once it's clearly overdue — keeps the "we aim to read within a
 * few days" promise visible to reviewers triaging the inbox.
 */
function waitTone(days: number): { surface: string; ink: string; border: string } {
  if (days <= 3) return { surface: "#f0fdf4", ink: "#166534", border: "#bbf7d0" };
  if (days <= 7) return { surface: "#fffbeb", ink: "#92400e", border: "#fde68a" };
  return { surface: "#fef2f2", ink: "#991b1b", border: "#fecaca" };
}

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
  const categoryFilter = pickString(sp.category).trim();
  const assignmentParam = pickString(sp.assignment).trim().toLowerCase();
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
  const assignmentFilter: "assigned" | "unassigned" | "" =
    assignmentParam === "assigned" || assignmentParam === "unassigned"
      ? assignmentParam
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
          template: { select: { id: true, title: true, category: true } },
          // Pull the active assignment count so we can colour rows and
          // gate the "assigned vs unassigned" admin filter without an
          // extra round trip.
          _count: {
            select: {
              assignments: {
                where: {
                  status: { in: ["SUGGESTED", "PENDING", "CONFIRMED", "COMPLETED"] },
                },
              },
            },
          },
        },
      }),
    []
  );

  // Categories list comes from BOTH the selected templates (which have a
  // strict `category` column) and the customWorkshop.category field stored
  // on the JSON blob for CUSTOM_DESIGN rows. Deduped + sorted.
  const allCategories = Array.from(
    new Set(
      submissions
        .flatMap((s) => {
          const fromTemplate = s.template?.category ?? "";
          const fromCustom =
            s.sourceType === "CUSTOM_DESIGN" &&
            s.customWorkshop &&
            typeof s.customWorkshop === "object"
              ? String(
                  (s.customWorkshop as Record<string, unknown>).category ?? ""
                )
              : "";
          return [fromTemplate, fromCustom];
        })
        .map((c) => c.trim())
        .filter(Boolean)
    )
  ).sort();

  function submissionCategory(s: (typeof submissions)[number]): string {
    if (s.template?.category) return s.template.category;
    if (
      s.sourceType === "CUSTOM_DESIGN" &&
      s.customWorkshop &&
      typeof s.customWorkshop === "object"
    ) {
      return String(
        (s.customWorkshop as Record<string, unknown>).category ?? ""
      ).trim();
    }
    return "";
  }

  function submissionAgeRange(s: (typeof submissions)[number]): string {
    if (
      s.sourceType === "CUSTOM_DESIGN" &&
      s.customWorkshop &&
      typeof s.customWorkshop === "object"
    ) {
      return String(
        (s.customWorkshop as Record<string, unknown>).targetAgeGroup ?? ""
      ).trim();
    }
    return "";
  }

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
    approvedUnplaced: submissions.filter(
      (s) => s.status === "APPROVED" && s._count.assignments === 0
    ).length,
  };

  // Apply the user's filters in-memory. Volumes here are small (per-chapter
  // or admin-wide queue of proposals) so a Prisma round-trip per filter
  // change is unnecessary; this also keeps the column counts in step with
  // the search box without a second query.
  const visible = submissions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (sourceFilter && s.sourceType !== sourceFilter) return false;
    if (categoryFilter && submissionCategory(s) !== categoryFilter) return false;
    if (assignmentFilter) {
      // Assignment filter is only meaningful for APPROVED rows. Drop
      // everything else when the admin scopes to placement state.
      if (s.status !== "APPROVED") return false;
      const placed = s._count.assignments > 0;
      if (assignmentFilter === "assigned" && !placed) return false;
      if (assignmentFilter === "unassigned" && placed) return false;
    }
    if (search) {
      const haystack = [
        s.author.name ?? "",
        s.author.email ?? "",
        s.template?.title ?? "",
        submissionCategory(s),
        submissionAgeRange(s),
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
        <Link
          href="?status=SUBMITTED"
          className="card"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            borderLeft: "4px solid #6b21c8",
          }}
        >
          <div className="kpi" style={{ color: "#6b21c8" }}>
            {counts.awaitingReview}
          </div>
          <div className="kpi-label">Awaiting review</div>
        </Link>
        <Link
          href="?status=CHANGES_REQUESTED"
          className="card"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            borderLeft: "4px solid #d97706",
          }}
        >
          <div className="kpi" style={{ color: "#d97706" }}>
            {counts.changesRequested}
          </div>
          <div className="kpi-label">Changes requested</div>
        </Link>
        <Link
          href="?status=APPROVED&assignment=unassigned"
          className="card"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "block",
            borderLeft: `4px solid ${
              counts.approvedUnplaced > 0 ? "#d97706" : "#16a34a"
            }`,
          }}
        >
          <div
            className="kpi"
            style={{ color: counts.approvedUnplaced > 0 ? "#d97706" : "#16a34a" }}
          >
            {counts.approvedUnplaced}
          </div>
          <div className="kpi-label">Approved · not yet placed</div>
        </Link>
        <div className="card">
          <div className="kpi">{counts.total}</div>
          <div className="kpi-label">Active submissions</div>
        </div>
      </div>

      <ReviewQueueFilters
        currentSearch={search}
        currentStatus={statusFilter}
        currentSource={sourceFilter}
        currentAssignment={assignmentFilter}
        currentCategory={categoryFilter}
        categories={allCategories}
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
          const palette = workshopStatusPalette(col.status);
          return (
            <div key={col.status}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 10,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: palette.surface,
                  border: `1px solid ${palette.border}`,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: palette.accent,
                    display: "inline-block",
                  }}
                />
                <span
                  style={{ fontWeight: 700, fontSize: 13, color: palette.ink }}
                >
                  {col.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    fontWeight: 700,
                    color: palette.ink,
                  }}
                >
                  {list.length}
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
                        const meta: string[] = [];
                        const cat = submissionCategory(s);
                        const age = submissionAgeRange(s);
                        if (cat) meta.push(cat);
                        if (age) meta.push(age);
                        if (meta.length === 0) return null;
                        return (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 11,
                              color: "var(--muted)",
                            }}
                          >
                            {meta.join(" · ")}
                          </p>
                        );
                      })()}
                      {(() => {
                        const palette = workshopStatusPalette(s.status);
                        return (
                          <span
                            className="pill pill-small"
                            style={{
                              marginTop: 8,
                              display: "inline-block",
                              background: palette.surface,
                              color: palette.ink,
                              border: `1px solid ${palette.border}`,
                            }}
                          >
                            {submissionStatusLabel(s.status)}
                          </span>
                        );
                      })()}
                      {s.status === "APPROVED" ? (
                        <span
                          className="pill pill-small"
                          style={{
                            marginTop: 8,
                            marginLeft: 6,
                            display: "inline-block",
                            background:
                              s._count.assignments > 0 ? "#dcfce7" : "#fef3c7",
                            color:
                              s._count.assignments > 0 ? "#166534" : "#92400e",
                            border: "1px solid currentColor",
                          }}
                        >
                          {s._count.assignments > 0
                            ? `Placed · ${s._count.assignments}`
                            : "Not yet placed"}
                        </span>
                      ) : null}
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
                      {col.status === "SUBMITTED" ||
                      col.status === "IN_REVIEW"
                        ? (() => {
                            const days = queueWaitDays(s.submittedAt);
                            if (days == null) return null;
                            const t = waitTone(days);
                            return (
                              <span
                                className="pill pill-small"
                                style={{
                                  marginTop: 6,
                                  display: "inline-block",
                                  background: t.surface,
                                  color: t.ink,
                                  border: `1px solid ${t.border}`,
                                }}
                              >
                                {days === 0
                                  ? "In queue today"
                                  : `Waiting ${days} day${
                                      days === 1 ? "" : "s"
                                    }`}
                              </span>
                            );
                          })()
                        : null}
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
