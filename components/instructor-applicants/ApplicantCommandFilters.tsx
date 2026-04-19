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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        padding: "10px 0",
      }}
    >
      {/* Chapter pivot — admin only */}
      {isAdmin && chapters.length > 0 && (
        <select
          className="input"
          value={getParam("chapterId")}
          onChange={(e) => setParam("chapterId", e.target.value)}
          style={{ width: "auto", minWidth: 140, marginBottom: 0 }}
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
          className="input"
          value={getParam("reviewerId")}
          onChange={(e) => setParam("reviewerId", e.target.value)}
          style={{ width: "auto", minWidth: 160, marginBottom: 0 }}
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
          className="input"
          value={getParam("interviewerId")}
          onChange={(e) => setParam("interviewerId", e.target.value)}
          style={{ width: "auto", minWidth: 160, marginBottom: 0 }}
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
        className={`button outline${materialsMissing ? " active" : ""}`}
        style={materialsMissing ? { background: "#fee2e2", borderColor: "#fca5a5", color: "#b91c1c" } : undefined}
        onClick={() => toggleParam("materialsMissing")}
      >
        Materials missing
      </button>

      <button
        type="button"
        className={`button outline${overdueOnly ? " active" : ""}`}
        style={overdueOnly ? { background: "#fef3c7", borderColor: "#fcd34d", color: "#b45309" } : undefined}
        onClick={() => toggleParam("overdueOnly")}
      >
        Overdue
      </button>

      {actorId && (
        <button
          type="button"
          className={`button outline${myCasesOnly ? " active" : ""}`}
          style={myCasesOnly ? { background: "#f3e8ff", borderColor: "#c4b5fd", color: "#6b21c8" } : undefined}
          onClick={() => toggleParam("myCasesOnly")}
        >
          My cases only
        </button>
      )}
    </div>
  );
}
