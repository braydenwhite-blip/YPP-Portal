"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { resolveEscalation } from "@/lib/people-strategy/action-items-actions";
import type {
  BoardRollupComment,
  BoardRollupRow,
} from "@/lib/people-strategy/board-rollup";

function CommentHistory({ comments }: { comments: BoardRollupComment[] }) {
  const [open, setOpen] = useState(false);
  if (comments.length === 0) {
    return (
      <p style={{ margin: "8px 0 0", color: "#94a3b8", fontSize: 13 }}>
        No comments yet.
      </p>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "#6b21c8",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {open ? "Hide" : "Show"} comment history ({comments.length})
      </button>
      {open && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {comments.map((c) => (
            <li
              key={c.id}
              style={{
                borderLeft: "3px solid #e2e8f0",
                padding: "4px 0 4px 12px",
                margin: "0 0 8px",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: "#1c1917" }}>{c.body}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                {c.authorName}
                {c.type === "INPUT_REQUESTED" ? " · Input requested" : ""} ·{" "}
                {c.createdAtLabel}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RollupCard({ row }: { row: BoardRollupRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleResolve() {
    setError(null);
    startTransition(async () => {
      try {
        await resolveEscalation(row.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resolve");
      }
    });
  }

  return (
    <div
      style={{
        border: "1px solid #fca5a5",
        borderRadius: 12,
        background: "#fff",
        padding: "16px 18px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-block",
                padding: "2px 10px",
                borderRadius: 999,
                background: "#991b1b1a",
                color: "#991b1b",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Board roll-up
            </span>
            <span style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}>
              {row.cpoAgeLabel} unresolved at Leadership
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              · rolled up {row.rolledUpAtLabel}
            </span>
          </div>
          <Link
            href={`/actions/${row.id}`}
            style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 16,
              fontWeight: 700,
              color: "#1c1917",
              textDecoration: "none",
            }}
          >
            {row.title}
          </Link>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#57534e" }}>
            <strong>Dept:</strong> {row.departmentName} &nbsp;·&nbsp;{" "}
            <strong>Status:</strong> {row.statusLabel} &nbsp;·&nbsp;{" "}
            <strong>Deadline:</strong> {row.deadlineLabel}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#57534e" }}>
            <strong>Lead:</strong> {row.leadName ?? "Unassigned"} &nbsp;·&nbsp;{" "}
            <strong>Executing:</strong>{" "}
            {row.executors.length > 0
              ? row.executors.map((e) => e.name ?? e.email ?? "—").join(", ")
              : "—"}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            onClick={handleResolve}
            disabled={isPending}
            style={{
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isPending ? "Resolving…" : "Mark resolved"}
          </button>
          {error && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c" }}>{error}</p>
          )}
        </div>
      </div>
      <CommentHistory comments={row.comments} />
    </div>
  );
}

export function BoardRollupList({ rows }: { rows: BoardRollupRow[] }) {
  return (
    <section style={{ margin: "8px 0 32px" }}>
      {rows.length === 0 ? (
        <div
          style={{
            border: "1px dashed #e2e8f0",
            borderRadius: 12,
            padding: "20px 18px",
            marginTop: 12,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          Nothing has rolled up to the Board — no Leadership escalation has gone
          unresolved past the 7-day threshold.
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <RollupCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
