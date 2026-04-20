"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

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

  const materialsMissing = searchParams.get("materialsMissing") === "1";
  const overdueOnly = searchParams.get("overdueOnly") === "1";
  const myCasesOnly = searchParams.get("myCasesOnly") === "1";

  return (
    <div className="applicant-command-filters">
      {/* Chapter pivot — admin only */}
      {isAdmin && chapters.length > 0 && (
        <select
          className="input applicant-command-select"
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
          className="input applicant-command-select"
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
          className="input applicant-command-select"
          value={getParam("interviewerId")}
          onChange={(e) => setParam("interviewerId", e.target.value)}
        >
          <option value="">Any interviewer</option>
          {interviewers.map((i) => (
            <option key={i.id} value={i.id}>{i.name ?? i.email}</option>
          ))}
        </select>
      )}

      {/* Toggle chips */}
      <button
        type="button"
        className={`button outline applicant-filter-chip${materialsMissing ? " active is-danger" : ""}`}
        onClick={() => toggleParam("materialsMissing")}
      >
        Materials missing
      </button>

      <button
        type="button"
        className={`button outline applicant-filter-chip${overdueOnly ? " active is-warning" : ""}`}
        onClick={() => toggleParam("overdueOnly")}
      >
        Overdue
      </button>

      {actorId && (
        <button
          type="button"
          className={`button outline applicant-filter-chip${myCasesOnly ? " active is-primary" : ""}`}
          onClick={() => toggleParam("myCasesOnly")}
        >
          My cases only
        </button>
      )}
    </div>
  );
}
