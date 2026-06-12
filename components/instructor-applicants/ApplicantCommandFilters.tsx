"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { cn } from "@/components/ui-v2";

const selectClass =
  "h-9 max-w-52 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400";

function chipClass(active: boolean, tone: "warning" | "brand" = "brand") {
  return cn(
    "cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-100",
    active
      ? tone === "warning"
        ? "border-warning-600 bg-amber-50 text-warning-600"
        : "border-brand-600 bg-brand-50 text-brand-700"
      : "border-line bg-surface text-ink-muted hover:bg-surface-soft hover:text-ink"
  );
}

type FilterUser = { id: string; name: string | null; email: string };

interface ApplicantCommandFiltersProps {
  isAdmin?: boolean;
  chapters?: Array<{ id: string; name: string }>;
  reviewers?: FilterUser[];
  interviewers?: FilterUser[];
  actorId?: string;
}

export default function ApplicantCommandFilters({
  isAdmin = false,
  chapters = [],
  reviewers = [],
  interviewers = [],
  actorId,
}: ApplicantCommandFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const getParam = (key: string) => searchParams.get(key) ?? "";

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const toggleParam = useCallback(
    (key: string) => {
      const current = searchParams.get(key);
      setParam(key, current ? "" : "1");
    },
    [searchParams, setParam]
  );

  const overdueOnly = searchParams.get("overdueOnly") === "1";
  const myCasesOnly = searchParams.get("myCasesOnly") === "1";

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      {/* Chapter pivot — admin only */}
      {isAdmin && chapters.length > 0 && (
        <select
          className={selectClass}
          value={getParam("chapterId")}
          onChange={(e) => setParam("chapterId", e.target.value)}
        >
          <option value="">All chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {/* Reviewer filter */}
      {reviewers.length > 0 && (
        <select
          className={selectClass}
          value={getParam("reviewerId")}
          onChange={(e) => setParam("reviewerId", e.target.value)}
        >
          <option value="">Any reviewer</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>{r.name ?? r.email}</option>
          ))}
        </select>
      )}

      {/* Interviewer filter */}
      {interviewers.length > 0 && (
        <select
          className={selectClass}
          value={getParam("interviewerId")}
          onChange={(e) => setParam("interviewerId", e.target.value)}
        >
          <option value="">Any interviewer</option>
          {interviewers.map((i) => (
            <option key={i.id} value={i.id}>{i.name ?? i.email}</option>
          ))}
        </select>
      )}

      {/* Source filter — PORTAL / GOOGLE_FORMS / CSV_IMPORT / MANUAL_ADMIN_ENTRY */}
      <select
        className={selectClass}
        value={getParam("source")}
        onChange={(e) => setParam("source", e.target.value)}
        aria-label="Filter by application source"
      >
        <option value="">Any source</option>
        <option value="portal">Portal</option>
        <option value="google_forms">Google Forms</option>
        <option value="csv_import">CSV Import</option>
        <option value="manual">Manual Admin Entry</option>
      </select>

      {/* Toggle chips */}
      <button
        type="button"
        aria-pressed={overdueOnly}
        className={chipClass(overdueOnly, "warning")}
        onClick={() => toggleParam("overdueOnly")}
      >
        Overdue
      </button>

      {actorId && (
        <button
          type="button"
          aria-pressed={myCasesOnly}
          className={chipClass(myCasesOnly)}
          onClick={() => toggleParam("myCasesOnly")}
        >
          My cases only
        </button>
      )}
    </div>
  );
}
