"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createChapterSupportRequest,
  resolveChapterSupportRequest,
} from "@/lib/chapters/actions";

const CATEGORIES = [
  ["CURRICULUM", "Curriculum help"],
  ["INSTRUCTOR", "Instructor help"],
  ["PARTNER", "Partner help"],
  ["RECRUITMENT", "Recruitment help"],
  ["EVENT_PLANNING", "Event planning help"],
  ["SCHOOL_APPROVAL", "School approval help"],
  ["GENERAL", "General leadership help"],
] as const;

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES) as Record<string, string>;

export type SupportRequestRow = {
  id: string;
  category: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  createdAt: string;
  requestedBy: { name: string } | null;
  assignedTo: { name: string } | null;
  resolvedAt: string | null;
};

const inputCls = "rounded-lg border border-line px-3 py-2 text-[14px]";

export function SupportRequestsPanel({
  chapterId,
  requests,
  canRequest,
  isLeadership,
}: {
  chapterId: string;
  requests: SupportRequestRow[];
  canRequest: boolean;
  isLeadership: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("CURRICULUM");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (title.trim().length < 3) {
      setError("Give the request a short title.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createChapterSupportRequest({ chapterId, category, title, details, priority });
        setTitle("");
        setDetails("");
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send the request.");
      }
    });
  }

  function resolve(id: string) {
    startTransition(async () => {
      try {
        await resolveChapterSupportRequest({ requestId: id });
        router.refresh();
      } catch {
        /* surfaced on next load */
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {canRequest && (
        <div>
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-800 hover:bg-brand-100"
            >
              + Request help from national
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-soft p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="LOW">Low priority</option>
                  <option value="MEDIUM">Medium priority</option>
                  <option value="HIGH">High priority</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <input
                className={inputCls}
                placeholder="What do you need help with?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className={inputCls}
                rows={2}
                placeholder="Any details (optional)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
              {error && <p className="text-[12.5px] text-blocked-700">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Send request"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-[13px] text-ink-muted">No support requests.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => {
            const resolved = r.status === "RESOLVED" || r.status === "CLOSED";
            return (
              <li key={r.id} className="rounded-lg border border-line-soft bg-surface px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">{r.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      resolved ? "bg-complete-50 text-complete-700" : "bg-progress-50 text-progress-700"
                    }`}
                  >
                    {resolved ? "Resolved" : r.status === "IN_PROGRESS" ? "In progress" : "Open"}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {CATEGORY_LABELS[r.category] ?? r.category}
                  {r.requestedBy ? ` · ${r.requestedBy.name}` : ""}
                  {r.assignedTo ? ` · owner: ${r.assignedTo.name}` : ""}
                </p>
                {r.details && <p className="mt-1 text-[12.5px] leading-snug text-ink">{r.details}</p>}
                {isLeadership && !resolved && (
                  <button
                    type="button"
                    onClick={() => resolve(r.id)}
                    disabled={pending}
                    className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium text-ink-muted hover:bg-surface-soft disabled:opacity-60"
                  >
                    Mark resolved
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
