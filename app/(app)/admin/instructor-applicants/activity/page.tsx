import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ApplicationReviewShell } from "@/components/applications/application-review-shell";
import { PageHeaderV2 } from "@/components/ui-v2";
import { requireChairPage } from "@/lib/page-guards";
import { formatApplicantDisplayName } from "@/lib/applicant-display-name";
import type { ReviewSignalKind, ReviewSignalSentiment } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 75;
const MAX_LIMIT = 200;

const KIND_LABELS: Record<ReviewSignalKind, string> = {
  COMMENT: "Comment",
  PIN_NOTE: "Pinned note",
  HIGHLIGHT: "Highlight",
  CONCERN: "Concern",
  CONSENSUS_NOTE: "Consensus note",
};

const KIND_COLORS: Record<ReviewSignalKind, string> = {
  COMMENT: "#64748b",
  PIN_NOTE: "#7c3aed",
  HIGHLIGHT: "#16a34a",
  CONCERN: "#ea580c",
  CONSENSUS_NOTE: "#0ea5e9",
};

const SENTIMENT_LABELS: Record<ReviewSignalSentiment, string> = {
  STRONG_HIRE: "Strong hire",
  HIRE: "Hire",
  MIXED: "Mixed",
  CONCERN: "Concern",
  REJECT: "Reject",
};

const KIND_FILTERS: ReadonlyArray<{ value: "ALL" | ReviewSignalKind; label: string }> = [
  { value: "ALL", label: "All signals" },
  { value: "COMMENT", label: "Comments" },
  { value: "CONCERN", label: "Concerns" },
  { value: "HIGHLIGHT", label: "Highlights" },
  { value: "PIN_NOTE", label: "Pinned notes" },
  { value: "CONSENSUS_NOTE", label: "Consensus" },
];

function deriveDisplayName(app: {
  preferredFirstName: string | null;
  lastName: string | null;
  legalName: string | null;
  applicant: { name: string | null } | null;
}): string {
  return formatApplicantDisplayName(app);
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function parseKind(value: string | string[] | undefined): "ALL" | ReviewSignalKind {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    raw === "COMMENT" ||
    raw === "PIN_NOTE" ||
    raw === "HIGHLIGHT" ||
    raw === "CONCERN" ||
    raw === "CONSENSUS_NOTE"
  ) {
    return raw;
  }
  return "ALL";
}

function parseLimit(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.floor(n));
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActivityFeedPage({ searchParams }: PageProps) {
  await requireChairPage();
  const params = await searchParams;
  const kindFilter = parseKind(params.kind);
  const limit = parseLimit(params.limit);
  const unresolvedOnly = params.unresolved === "1";

  const signals = await prisma.reviewSignal.findMany({
    where: {
      ...(kindFilter !== "ALL" ? { kind: kindFilter } : {}),
      ...(unresolvedOnly ? { resolvedAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      applicationId: true,
      kind: true,
      sentiment: true,
      body: true,
      pinned: true,
      resolvedAt: true,
      createdAt: true,
      parentId: true,
      author: { select: { id: true, name: true } },
      application: {
        select: {
          id: true,
          preferredFirstName: true,
          lastName: true,
          legalName: true,
          status: true,
          applicant: {
            select: {
              name: true,
              chapter: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const totals = await prisma.reviewSignal.groupBy({
    by: ["kind"],
    _count: { _all: true },
    where: unresolvedOnly ? { resolvedAt: null } : undefined,
  });
  const totalsByKind = new Map<ReviewSignalKind, number>(
    totals.map((t) => [t.kind, t._count._all])
  );
  const totalAll = totals.reduce((sum, t) => sum + t._count._all, 0);

  function makeHref(
    nextKind: "ALL" | ReviewSignalKind = kindFilter,
    unresolved = unresolvedOnly,
    nextLimit = limit
  ): string {
    const sp = new URLSearchParams();
    if (nextKind !== "ALL") sp.set("kind", nextKind);
    if (unresolved) sp.set("unresolved", "1");
    if (nextLimit !== DEFAULT_LIMIT) sp.set("limit", String(nextLimit));
    const qs = sp.toString();
    return qs
      ? `/admin/instructor-applicants/activity?${qs}`
      : "/admin/instructor-applicants/activity";
  }

  const canLoadMore = signals.length >= limit && limit < MAX_LIMIT;
  const nextLimit = Math.min(MAX_LIMIT, limit + DEFAULT_LIMIT);

  return (
    <ApplicationReviewShell
      maxWidth={1100}
      header={
        <PageHeaderV2
          eyebrow="Hiring chair"
          title="Reviewer activity"
          subtitle="Every reviewer comment, concern, highlight, and chair note across all applications — newest first."
          actions={
            <Link
              href="/admin/instructor-applicants/chair-queue"
              className="text-[13px] font-semibold text-brand-700 hover:underline"
            >
              Chair queue →
            </Link>
          }
        />
      }
      actions={[
        { label: "Application board", href: "/admin/instructor-applicants", icon: "list" },
        { label: "Home", href: "/", icon: "compass" },
      ]}
    >
      <section className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KIND_FILTERS.map((f) => {
              const isActive = f.value === kindFilter;
              const count =
                f.value === "ALL" ? totalAll : totalsByKind.get(f.value) ?? 0;
              return (
                <Link
                  key={f.value}
                  href={makeHref(f.value)}
                  className={`badge${isActive ? " badge-active" : ""}`}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: isActive ? "var(--primary, #7c3aed)" : "var(--surface)",
                    color: isActive ? "white" : "inherit",
                    border: "1px solid var(--border)",
                    textDecoration: "none",
                    fontSize: 13,
                  }}
                >
                  {f.label} · {count}
                </Link>
              );
            })}
          </div>
          <Link
            href={makeHref(kindFilter, !unresolvedOnly)}
            className="link"
            style={{ fontSize: 13 }}
          >
            {unresolvedOnly ? "Show resolved too" : "Unresolved only"}
          </Link>
        </div>
      </section>

      {signals.length === 0 ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No activity</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            No reviewer signals match the current filter. Try clearing filters or
            check back after reviewers submit feedback.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {signals.map((signal) => {
            const app = signal.application;
            if (!app) return null;
            const displayName = deriveDisplayName(app);
            const chapterName = app.applicant?.chapter?.name ?? null;
            const isReply = signal.parentId !== null;
            return (
              <li
                key={signal.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  padding: "14px 16px",
                  borderLeft: `4px solid ${KIND_COLORS[signal.kind]}`,
                  opacity: signal.resolvedAt ? 0.65 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        color: KIND_COLORS[signal.kind],
                      }}
                    >
                      {KIND_LABELS[signal.kind]}
                      {isReply ? " · reply" : ""}
                    </span>
                    {signal.sentiment ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--surface-muted, #f1f5f9)",
                          color: "var(--muted)",
                        }}
                      >
                        {SENTIMENT_LABELS[signal.sentiment]}
                      </span>
                    ) : null}
                    {signal.pinned ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#fef3c7",
                          color: "#92400e",
                        }}
                      >
                        Pinned
                      </span>
                    ) : null}
                    {signal.resolvedAt ? (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "#dcfce7",
                          color: "#166534",
                        }}
                      >
                        Resolved
                      </span>
                    ) : null}
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>
                    {formatRelative(signal.createdAt)}
                  </span>
                </div>

                <div style={{ marginBottom: 8 }}>
                  <Link
                    href={`/admin/instructor-applicants/${app.id}/review`}
                    style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
                  >
                    {displayName}
                  </Link>
                  {chapterName ? (
                    <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 13 }}>
                      · {chapterName}
                    </span>
                  ) : null}
                  <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 13 }}>
                    · {signal.author?.name ?? "Unknown reviewer"}
                  </span>
                </div>

                <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {signal.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {canLoadMore ? (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link href={makeHref(kindFilter, unresolvedOnly, nextLimit)} className="link">
            Load more
          </Link>
        </div>
      ) : null}
    </ApplicationReviewShell>
  );
}
