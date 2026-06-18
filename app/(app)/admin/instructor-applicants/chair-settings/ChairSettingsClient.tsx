"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui-v2";
import { setActiveChairAction } from "@/lib/active-chair-actions";
import type { ChairHistoryEntry } from "@/lib/active-chair";

type EligibleUser = {
  id: string;
  name: string | null;
  email: string;
  roles: string[];
};

interface Props {
  activeChair: { id: string; name: string | null; email: string } | null;
  eligible: EligibleUser[];
  history: ChairHistoryEntry[];
}

function displayName(user: { name: string | null; email: string } | null): string {
  if (!user) return "No Chair assigned";
  return user.name?.trim() || user.email;
}

export default function ChairSettingsClient({ activeChair, eligible, history }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [eligible, query]);

  const selected = eligible.find((u) => u.id === selectedId) ?? null;
  const isNoOp = selected && activeChair && selected.id === activeChair.id;

  function handleConfirm() {
    if (!selected) return;
    setError(null);
    const fd = new FormData();
    fd.set("newChairUserId", selected.id);
    startTransition(async () => {
      const result = await setActiveChairAction(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setConfirming(false);
      setSelectedId("");
      setQuery("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5">
      {/* Current Chair */}
      <section className="rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Current Chair
        </p>
        <p className="mt-1 text-[18px] font-bold text-ink">{displayName(activeChair)}</p>
        {activeChair ? (
          <p className="mt-0.5 text-[13px] text-ink-muted">{activeChair.email}</p>
        ) : (
          <p className="mt-0.5 text-[13px] text-ink-muted">
            No Chair is assigned yet. Until one is assigned, no final applicant decision can be submitted.
          </p>
        )}
      </section>

      {/* Change Chair */}
      <section className="rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Change Chair
        </p>

        <label className="mt-3 block text-[12.5px] font-semibold text-ink">
          Search eligible users (Admins &amp; Hiring Chairs)
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="mt-1 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-[14px] text-ink"
          />
        </label>

        <div className="mt-3 max-h-[260px] overflow-auto rounded-[8px] border border-line-soft">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-muted">No matching eligible users.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {filtered.map((user) => {
                const isSelected = user.id === selectedId;
                const isCurrent = activeChair?.id === user.id;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(user.id)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[13.5px] ${
                        isSelected ? "bg-brand-50" : "hover:bg-surface-soft"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">
                          {user.name?.trim() || user.email}
                        </span>
                        <span className="block truncate text-[12px] text-ink-muted">
                          {user.email} · {user.roles.join(", ")}
                        </span>
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                          Current
                        </span>
                      ) : isSelected ? (
                        <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p className="mt-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        ) : null}

        {/* Confirmation flow */}
        {confirming && selected ? (
          <div className="mt-4 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13.5px] text-amber-900">
              Replace <strong>{displayName(activeChair)}</strong> with{" "}
              <strong>{displayName(selected)}</strong> as the active Chair? The
              previous Chair will immediately lose final-decision permission.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirm}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                {pending ? "Saving…" : "Confirm change"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              disabled={!selected || Boolean(isNoOp)}
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              {isNoOp ? "Already the current Chair" : "Review &amp; change Chair"}
            </button>
          </div>
        )}
      </section>

      {/* History */}
      <section className="rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-700">
          Change History
        </p>
        {history.length === 0 ? (
          <p className="mt-2 text-[13px] text-ink-muted">No Chair changes recorded yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2.5">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-[8px] border border-line-soft bg-surface-soft px-3 py-2.5 text-[13px] text-ink"
              >
                <span className="font-semibold">
                  {entry.previousChair?.name ?? "No previous Chair"}
                </span>{" "}
                →{" "}
                <span className="font-semibold">{entry.newChair?.name ?? "Unknown"}</span>
                <span className="block text-[12px] text-ink-muted">
                  Changed by {entry.changedBy?.name ?? "Unknown"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
