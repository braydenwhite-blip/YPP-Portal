"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  archiveChapterDetails,
  deleteChapterDetails,
  restoreChapterDetails,
  saveChapterDetails,
} from "@/lib/chapters/admin-details-actions";
import { ChapterPlaceSearch } from "@/components/chapters/chapter-place-search";
import { Button } from "@/components/ui-v2";

const fieldClass =
  "rounded-[10px] border border-line-card px-3 py-2 text-[14px] font-normal outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function AdminChapterDetailsForm({
  chapterId,
  name,
  city,
  state,
  country,
  partner,
  notes,
  archivedAt,
  memberCount,
}: {
  chapterId: string;
  name: string;
  city: string;
  state: string;
  country: string;
  partner: string;
  notes: string;
  archivedAt: string | null;
  memberCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState({ city, state, country });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setError(null);
    startTransition(async () => {
      const res = await saveChapterDetails({
        chapterId,
        name: String(data.get("name") ?? ""),
        city: place.city,
        state: place.state,
        country: place.country,
        partner: String(data.get("partner") ?? ""),
        notes: String(data.get("notes") ?? ""),
      });
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function runAction(fn: () => Promise<{ ok: true } | { ok: true; deleted: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if ("deleted" in res && res.deleted) router.push("/admin/chapters");
      else router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 px-5 py-4">
        {error ? (
          <p className="m-0 rounded-[10px] bg-blocked-50 px-3 py-2 text-[13px] text-blocked-700">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
          Name
          <input name="name" required maxLength={80} defaultValue={name} className={fieldClass} />
        </label>
        <ChapterPlaceSearch
          city={place.city}
          state={place.state}
          country={place.country}
          onChange={setPlace}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            City
            <input
              maxLength={120}
              value={place.city}
              onChange={(e) => setPlace((p) => ({ ...p, city: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            State
            <input
              maxLength={120}
              value={place.state}
              onChange={(e) => setPlace((p) => ({ ...p, state: e.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Country
            <input
              maxLength={120}
              value={place.country}
              onChange={(e) => setPlace((p) => ({ ...p, country: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
            Partner
            <input name="partner" maxLength={120} defaultValue={partner} className={fieldClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px] font-medium text-ink">
          Notes
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={notes} className={fieldClass} />
        </label>
        <Button type="submit" variant="primary" size="md" className="self-start" loading={pending}>
          Save
        </Button>
      </form>

      <details className="border-t border-line-card px-5 py-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-ink-muted hover:text-ink">
          Archive or delete
        </summary>
        {archivedAt ? (
          <div className="mt-3">
            <p className="m-0 mb-3 text-[13px] text-ink-muted">
              Archived {new Date(archivedAt).toLocaleDateString()}. Members stay attached.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={pending}
              onClick={() => runAction(() => restoreChapterDetails({ chapterId }))}
            >
              Restore
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="m-0 mb-2 text-[13px] text-ink-muted">
                Archive hides it from the list. You can restore later.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() => runAction(() => archiveChapterDetails({ chapterId }))}
              >
                Archive
              </Button>
            </div>
            <div>
              <p className="m-0 mb-2 text-[13px] text-ink-muted">
                Permanent delete only works with no members.
              </p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={memberCount > 0}
                loading={pending}
                onClick={() => runAction(() => deleteChapterDetails({ chapterId }))}
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      </details>
    </>
  );
}
