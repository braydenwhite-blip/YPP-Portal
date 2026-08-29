"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Button,
  ButtonLink,
  DataTableShell,
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

function formatAppliedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysWaiting(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t === 0) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

export function HiringWaitlistView({ entries }: { entries: HiringWaitlistEntry[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "instructor" | "cp" | "staff"
  >("all");

  const filtered =
    roleFilter === "all" ? entries : entries.filter((e) => e.kind === roleFilter);

  const next = filtered[0] ?? null;
  const globalIndex = new Map(entries.map((e, i) => [e.key, i]));
  const roleCounts = {
    instructor: entries.filter((e) => e.kind === "instructor").length,
    cp: entries.filter((e) => e.kind === "cp").length,
    staff: entries.filter((e) => e.kind === "staff").length,
  };

  const filterLabel =
    roleFilter === "all"
      ? "All roles"
      : roleFilter === "instructor"
        ? "Instructor"
        : roleFilter === "cp"
          ? "Chapter president"
          : "Staff / tech";

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
        // redirect() throws — ignore; navigation is in progress.
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

  return (
    <div className="flex flex-col gap-5">
      {entries.length === 0 ? (
        <section className="rounded-[12px] border border-line-soft bg-surface px-5 py-8 text-center">
          <p className="text-[15px] font-semibold text-ink">Hire queue is empty</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            When someone applies for instructor, chapter president, or staff, they land
            here until you pull them into interviews.
          </p>
          <Link
            href="/admin/instructor-applicants"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-4 inline-flex")}
          >
            Applicants board
          </Link>
        </section>
      ) : next ? (
        <section className="rounded-[12px] border border-brand-200 bg-brand-50/60 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-700">
                {roleFilter === "all"
                  ? "Next to interview"
                  : `Next ${filterLabel.toLowerCase()} to interview`}
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-ink">
                {next.name}
              </h2>
              <p className="mt-0.5 break-words text-[13px] text-ink-muted">
                {next.roleLabel}
                {next.chapterName ? ` · ${next.chapterName}` : ""}
                {next.email ? ` · ${next.email}` : ""}
              </p>
              {next.subjects ? (
                <p className="mt-2 text-[12.5px] text-ink-muted line-clamp-2">
                  {next.subjects}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={pending}
                onClick={() => selectForInterview(next)}
              >
                {pending ? "Starting…" : "Start interviews"}
              </Button>
              <ButtonLink href={next.href} variant="secondary" size="md">
                Open profile
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[12px] border border-line-soft bg-surface px-5 py-4">
          <p className="text-[14px] font-semibold text-ink">
            No one in {filterLabel.toLowerCase()}
          </p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {entries.length} {entries.length === 1 ? "person is" : "people are"} in the hire
            queue for other roles. Switch filters or view all roles.
          </p>
        </section>
      )}

      <DataTableShell
        header={
          <>
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Applicant hire queue</h3>
              <p className="text-[12.5px] text-ink-muted">
                {filtered.length === 0
                  ? "No one waiting"
                  : filtered.length === 1
                    ? "1 applicant — Start interviews pulls them onto the board"
                    : `${filtered.length} applicants — reorder freely; #1 is next when you need someone`}
              </p>
            </div>
            <div className="flex gap-0.5 rounded-lg border border-line-card bg-surface p-0.5">
              {(
                [
                  ["all", "All roles", entries.length] as const,
                  ["instructor", "Instructor", roleCounts.instructor] as const,
                  ["cp", "Chapter president", roleCounts.cp] as const,
                  ["staff", "Staff / tech", roleCounts.staff] as const,
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoleFilter(value)}
                  className={
                    roleFilter === value
                      ? "rounded-md bg-brand-600 px-2.5 py-1.5 text-[12px] font-semibold text-white"
                      : "rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted hover:bg-surface-soft hover:text-ink"
                  }
                >
                  {label}
                  {count > 0 ? ` (${count})` : ""}
                </button>
              ))}
            </div>
          </>
        }
      >
        {error ? (
          <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}
        <TableV2>
          <thead>
            <tr>
              <TableHeadCell className="w-14">#</TableHeadCell>
              <TableHeadCell>Person</TableHeadCell>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Chapter</TableHeadCell>
              <TableHeadCell>Applied</TableHeadCell>
              <TableHeadCell className="text-right">Actions</TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <TableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  No applicants in this filter.
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
                    className={isNext ? "bg-brand-50/40" : undefined}
                  >
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[12px] font-bold",
                          isNext
                            ? "bg-brand-600 text-white"
                            : "bg-surface-soft text-ink-muted"
                        )}
                        title={
                          roleFilter === "all"
                            ? undefined
                            : `#${displayRank} in ${filterLabel.toLowerCase()} · #${globalRank} overall`
                        }
                      >
                        {displayRank}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={entry.href}
                            className="font-semibold text-ink no-underline hover:text-brand-700"
                          >
                            {entry.name}
                          </Link>
                          {isNext ? (
                            <StatusBadge tone="brand">Next</StatusBadge>
                          ) : null}
                        </div>
                        <p className="truncate text-[12px] text-ink-muted">{entry.email}</p>
                        {entry.subjects ? (
                          <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">
                            {entry.subjects}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-ink">{entry.roleLabel}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-ink-muted">{entry.chapterName ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="text-ink">{formatAppliedDate(entry.waitlistedAt)}</div>
                      {days != null ? (
                        <div className="text-[12px] text-ink-muted">
                          {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={pending}
                          onClick={() => selectForInterview(entry)}
                        >
                          Interview
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending || globalRank <= 1}
                          onClick={() => move(entry.key, "up")}
                          title="Move up"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pending || globalRank >= entries.length}
                          onClick={() => move(entry.key, "down")}
                          title="Move down"
                        >
                          ↓
                        </Button>
                        {globalRank > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pending}
                            onClick={() => move(entry.key, "top")}
                            title="Move to top (next to interview)"
                          >
                            To top
                          </Button>
                        ) : null}
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
