"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  Button,
  ButtonLink,
  DataTableShell,
  EmptyStateV2,
  StatusBadge,
  TableCell,
  TableHeadCell,
  TableV2,
  buttonVariants,
} from "@/components/ui-v2";
import { cn } from "@/components/ui-v2";
import {
  moveHiringWaitlistEntry,
  selectHiringWaitlistCandidate,
} from "@/lib/hiring-waitlist/actions";
import type { HiringWaitlistEntry } from "@/lib/hiring-waitlist/types";

type RoleFilter = "all" | "instructor" | "cp" | "staff";

const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "instructor", label: "Instructor" },
  { value: "cp", label: "Chapter President" },
  { value: "staff", label: "Technology Manager" },
];

function formatAppliedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function daysWaiting(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t === 0) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

function waitLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function kindTone(kind: HiringWaitlistEntry["kind"]): "brand" | "info" | "neutral" {
  if (kind === "instructor") return "brand";
  if (kind === "cp") return "info";
  return "neutral";
}

export function HiringWaitlistView({ entries }: { entries: HiringWaitlistEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");

  const roleCounts = useMemo(
    () => ({
      all: entries.length,
      instructor: entries.filter((e) => e.kind === "instructor").length,
      cp: entries.filter((e) => e.kind === "cp").length,
      staff: entries.filter((e) => e.kind === "staff").length,
    }),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (roleFilter !== "all" && e.kind !== roleFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.chapterName?.toLowerCase().includes(q) ?? false) ||
        e.roleLabel.toLowerCase().includes(q) ||
        (e.subjects?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [entries, roleFilter, query]);

  const next = filtered[0] ?? null;
  const globalIndex = useMemo(
    () => new Map(entries.map((e, i) => [e.key, i])),
    [entries]
  );

  function move(key: string, direction: "up" | "down" | "top") {
    setError(null);
    startTransition(async () => {
      const result = await moveHiringWaitlistEntry({ key, direction });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function selectForInterview(entry: HiringWaitlistEntry) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await selectHiringWaitlistCandidate({ key: entry.key });
        if (result?.ok === false) {
          setError(result.error);
        }
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          String((err as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : "Could not start interviews.");
      }
    });
  }

  if (entries.length === 0) {
    return (
      <EmptyStateV2
        title="No one on the waitlist"
        body="New instructor, chapter president, and staff applications land here after signup. Pull someone when you’re ready to start interviews."
        action={
          <Link
            href="/admin/instructor-applicants"
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            Applicants board
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700"
        >
          {error}
        </p>
      ) : null}

      <DataTableShell
        header={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink">Hire order</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {filtered.length === entries.length
                    ? `${entries.length} waiting · #1 is next to interview`
                    : `${filtered.length} shown of ${entries.length}`}
                </p>
              </div>
              {next ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden text-[12.5px] text-ink-muted sm:inline">
                    Next: <span className="font-semibold text-ink">{next.name}</span>
                  </span>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={pending}
                    onClick={() => selectForInterview(next)}
                  >
                    {pending ? "Starting…" : "Start interviews"}
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Role filter"
                className="flex flex-wrap gap-0.5 rounded-[10px] border border-line-soft bg-surface-soft p-0.5"
              >
                {ROLE_FILTERS.map(({ value, label }) => {
                  const count = roleCounts[value];
                  const active = roleFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoleFilter(value)}
                      className={cn(
                        "rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
                        active
                          ? "bg-surface text-ink shadow-sm"
                          : "text-ink-muted hover:text-ink"
                      )}
                    >
                      {label}
                      <span className="ml-1.5 tabular-nums text-ink-muted">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, chapter…"
                aria-label="Search waitlist"
                className="h-9 min-w-[12rem] flex-1 rounded-[8px] border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 sm:max-w-xs"
              />
            </div>
          </div>
        }
      >
        <TableV2>
          <thead>
            <tr>
              <TableHeadCell className="w-12">#</TableHeadCell>
              <TableHeadCell>Applicant</TableHeadCell>
              <TableHeadCell className="hidden md:table-cell">Role</TableHeadCell>
              <TableHeadCell className="hidden lg:table-cell">Chapter</TableHeadCell>
              <TableHeadCell className="hidden sm:table-cell">Waiting</TableHeadCell>
              <TableHeadCell className="text-right"> </TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <TableCell colSpan={6} className="py-12 text-center text-ink-muted">
                  No matches for this filter.
                </TableCell>
              </tr>
            ) : (
              filtered.map((entry, filterIndex) => {
                const globalRank = (globalIndex.get(entry.key) ?? 0) + 1;
                const displayRank = filterIndex + 1;
                const days = daysWaiting(entry.waitlistedAt);
                const isNext = entry.key === next?.key;

                return (
                  <tr
                    key={entry.key}
                    className={cn(
                      "align-middle",
                      isNext && "bg-brand-50/50"
                    )}
                  >
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[12px] font-bold tabular-nums",
                          isNext
                            ? "bg-brand-600 text-white"
                            : "bg-surface-soft text-ink-muted"
                        )}
                        title={
                          roleFilter === "all"
                            ? undefined
                            : `#${displayRank} in filter · #${globalRank} overall`
                        }
                      >
                        {displayRank}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-0 max-w-[22rem]">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={entry.href}
                            className="truncate font-semibold text-ink no-underline hover:text-brand-700"
                          >
                            {entry.name}
                          </Link>
                          {isNext ? <StatusBadge tone="brand">Next</StatusBadge> : null}
                        </div>
                        <p className="truncate text-[12px] text-ink-muted">{entry.email}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                          <StatusBadge tone={kindTone(entry.kind)}>
                            {entry.roleLabel}
                          </StatusBadge>
                          {entry.chapterName ? (
                            <span className="text-[12px] text-ink-muted">
                              {entry.chapterName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      <StatusBadge tone={kindTone(entry.kind)}>
                        {entry.roleLabel}
                      </StatusBadge>
                    </TableCell>

                    <TableCell className="hidden lg:table-cell">
                      <span className="text-[13px] text-ink-muted">
                        {entry.chapterName ?? "—"}
                      </span>
                    </TableCell>

                    <TableCell className="hidden sm:table-cell">
                      <div className="text-[13px] text-ink">{waitLabel(days)}</div>
                      <div className="text-[11.5px] text-ink-muted">
                        {formatAppliedDate(entry.waitlistedAt)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {isNext ? (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={pending}
                            onClick={() => selectForInterview(entry)}
                          >
                            Interview
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => selectForInterview(entry)}
                          >
                            Interview
                          </Button>
                        )}
                        <div className="inline-flex overflow-hidden rounded-[8px] border border-line-soft">
                          <button
                            type="button"
                            disabled={pending || globalRank <= 1}
                            onClick={() => move(entry.key, "up")}
                            title="Move up"
                            aria-label="Move up"
                            className="px-2 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-ink disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={pending || globalRank >= entries.length}
                            onClick={() => move(entry.key, "down")}
                            title="Move down"
                            aria-label="Move down"
                            className="border-l border-line-soft px-2 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-ink disabled:opacity-40"
                          >
                            ↓
                          </button>
                          {globalRank > 1 ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => move(entry.key, "top")}
                              title="Move to top"
                              aria-label="Move to top"
                              className="border-l border-line-soft px-2 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-ink disabled:opacity-40"
                            >
                              Top
                            </button>
                          ) : null}
                        </div>
                        <ButtonLink href={entry.href} variant="ghost" size="sm">
                          Open
                        </ButtonLink>
                      </div>
                    </TableCell>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableV2>
      </DataTableShell>
    </div>
  );
}
