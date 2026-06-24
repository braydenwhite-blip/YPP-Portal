"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLaunchChecklistItem } from "@/lib/chapters/actions";

export type LaunchChecklistItem = {
  id: string;
  key: string | null;
  title: string;
  description: string | null;
  owner: string;
  leadershipOnly: boolean;
  ownerLabel: string;
  dueDate: string | null;
  done: boolean;
};

export function LaunchChecklist({
  chapterId,
  items,
  progress,
  canManage,
  isLeadership,
}: {
  chapterId: string;
  items: LaunchChecklistItem[];
  progress: { done: number; total: number; percent: number };
  canManage: boolean;
  isLeadership: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(item: LaunchChecklistItem) {
    if (!canManage) return;
    if (item.leadershipOnly && !isLeadership) return;
    setError(null);
    setBusyId(item.id);
    startTransition(async () => {
      try {
        await toggleLaunchChecklistItem({ chapterId, launchTaskId: item.id, done: !item.done });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update the checklist.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-idle-50">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="text-[12.5px] font-semibold text-ink-muted">
          {progress.done}/{progress.total} done
        </span>
      </div>

      {error && <p className="text-[12.5px] text-blocked-700">{error}</p>}

      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const locked = !canManage || (item.leadershipOnly && !isLeadership);
          return (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-line-soft bg-surface px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => toggle(item)}
                disabled={locked || (pending && busyId === item.id)}
                aria-pressed={item.done}
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border text-[12px] font-bold transition ${
                  item.done
                    ? "border-complete-700 bg-complete-700 text-white"
                    : "border-line bg-surface text-transparent hover:border-brand-400"
                } ${locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                title={
                  locked
                    ? item.leadershipOnly
                      ? "Only national leadership can complete this step"
                      : "Read only"
                    : item.done
                      ? "Mark not done"
                      : "Mark done"
                }
              >
                ✓
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span
                    className={`text-[13.5px] font-semibold ${item.done ? "text-ink-muted line-through" : "text-ink"}`}
                  >
                    {item.title}
                  </span>
                  <span className="rounded-full bg-idle-50 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-muted">
                    {item.ownerLabel}
                  </span>
                  {item.dueDate && (
                    <span className="text-[11px] text-ink-muted">
                      due {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{item.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
