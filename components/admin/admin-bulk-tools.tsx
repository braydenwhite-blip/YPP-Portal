"use client";

import { useState } from "react";
import { RoleType } from "@prisma/client";

import { Button, CardV2 } from "@/components/ui-v2";
import { formatAccessLabel } from "@/lib/admin-user-access";

const inputClass =
  "mt-1 w-full rounded-[9px] border border-line bg-surface px-3 py-2 text-[13.5px] text-ink outline-none focus:border-brand-400";

/**
 * CSV import / export / bulk role update — collapsed under Users so the
 * everyday create + edit table stays front and center.
 */
export function AdminBulkTools({
  chapters,
  flash,
}: {
  chapters: Array<{ id: string; name: string; city?: string | null }>;
  flash?: {
    imported?: number;
    failed?: number;
    duplicates?: number;
    invalid?: number;
    updated?: number;
    dryRun?: boolean;
    error?: string;
  };
}) {
  const [open, setOpen] = useState(Boolean(flash?.error || (flash?.imported ?? 0) > 0 || (flash?.updated ?? 0) > 0));

  return (
    <div className="flex flex-col gap-3">
      {flash && (flash.error || flash.imported || flash.failed || flash.updated) ? (
        <div
          className={[
            "rounded-[10px] border px-4 py-3 text-[13px]",
            flash.error
              ? "border-danger-200 bg-danger-50 text-danger-800"
              : "border-complete-200 bg-complete-50 text-complete-800",
          ].join(" ")}
        >
          <p className="m-0 font-semibold">
            {flash.dryRun ? "Preview only" : "Bulk update"}
          </p>
          <p className="m-0 mt-1">
            Imported {flash.imported ?? 0} · Failed {flash.failed ?? 0} · Duplicates{" "}
            {flash.duplicates ?? 0} · Invalid {flash.invalid ?? 0} · Updated{" "}
            {flash.updated ?? 0}
          </p>
          {flash.error ? <p className="m-0 mt-1">{flash.error}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-[10px] border border-dashed border-line px-4 py-2.5 text-left transition-colors hover:border-line hover:bg-surface-soft"
      >
        <span className="text-[13px] text-ink-muted">
          Need CSV import, export, or bulk role updates?
        </span>
        <span className="text-[13px] font-semibold text-brand-700">
          {open ? "Hide" : "Show tools"}
        </span>
      </button>

      {open ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CardV2 padding="md" className="flex flex-col gap-3">
            <h3 className="m-0 text-[15px] font-bold text-ink">Import CSV</h3>
            <p className="m-0 text-[12.5px] text-ink-muted">
              Columns: <code className="text-[12px]">name,email,role,chapter</code>
            </p>
            <form
              action="/api/admin/bulk-users/import"
              method="POST"
              encType="multipart/form-data"
              className="flex flex-col gap-3"
            >
              <label className="block text-[13px] font-medium text-ink">
                File
                <input
                  className={inputClass}
                  type="file"
                  name="csvFile"
                  accept=".csv"
                  required
                />
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Default role (if missing in CSV)
                <select className={inputClass} name="rolePreset" defaultValue="">
                  <option value="">Use CSV role</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="CHAPTER_PRESIDENT">Chapter President</option>
                  <option value="STUDENT">Student</option>
                  <option value="PARENT">Parent</option>
                </select>
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Default chapter
                <select className={inputClass} name="defaultChapterId" defaultValue="">
                  <option value="">None</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` (${c.city})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="dryRun" value="true" className="h-4 w-4" />
                Preview only (don’t create accounts)
              </label>
              <Button type="submit" variant="primary" size="md">
                Run import
              </Button>
            </form>
          </CardV2>

          <CardV2 padding="md" className="flex flex-col gap-3">
            <h3 className="m-0 text-[15px] font-bold text-ink">Export</h3>
            <p className="m-0 text-[12.5px] text-ink-muted">
              Download a CSV for audits or chapter ops.
            </p>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="all" />
              <Button type="submit" variant="primary" size="md" className="w-full">
                Export all users
              </Button>
            </form>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="students" />
              <Button type="submit" variant="secondary" size="md" className="w-full">
                Export students
              </Button>
            </form>
            <form action="/api/admin/bulk-users/export" method="POST">
              <input type="hidden" name="format" value="instructors" />
              <Button type="submit" variant="secondary" size="md" className="w-full">
                Export instructors
              </Button>
            </form>
          </CardV2>

          <CardV2 padding="md" className="flex flex-col gap-3 lg:col-span-2">
            <h3 className="m-0 text-[15px] font-bold text-ink">Update many at once</h3>
            <p className="m-0 text-[12.5px] text-ink-muted">
              Paste emails, pick a role and optional chapter.
            </p>
            <form
              action="/api/admin/bulk-users/update-roles"
              method="POST"
              className="grid gap-3 md:grid-cols-3"
            >
              <label className="block text-[13px] font-medium text-ink md:col-span-3">
                Emails (one per line)
                <textarea
                  className={`${inputClass} font-mono`}
                  name="emails"
                  required
                  rows={5}
                  placeholder="person@example.com"
                />
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Role
                <select
                  className={inputClass}
                  name="primaryRole"
                  required
                  defaultValue="STUDENT"
                >
                  {Object.values(RoleType).map((role) => (
                    <option key={role} value={role}>
                      {formatAccessLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Chapter
                <select className={inputClass} name="chapterId" defaultValue="">
                  <option value="">Keep current</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[13px] font-medium text-ink">
                Mode
                <select className={inputClass} name="mode" defaultValue="apply">
                  <option value="apply">Apply</option>
                  <option value="validate">Preview only</option>
                </select>
              </label>
              <div className="md:col-span-3">
                <Button type="submit" variant="primary" size="md">
                  Update users
                </Button>
              </div>
            </form>
          </CardV2>
        </div>
      ) : null}
    </div>
  );
}
