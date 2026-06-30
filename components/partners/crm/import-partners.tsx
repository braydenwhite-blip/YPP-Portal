"use client";

/**
 * Bulk partner import (Partner Automation, Phase 1). Paste a table from Google
 * Sheets / a CSV; preview parsed rows with duplicate warnings; import in one
 * click. Turns spreadsheet research into portal records.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink, CardV2, StatusBadge, ToastV2 } from "@/components/ui-v2";
import { parsePartnerRows } from "@/lib/partners/import-parse";
import { findLikelyDuplicates, type PartnerIdentity } from "@/lib/partners/duplicate-detection";
import { importChapterPartners } from "@/lib/partners/crm-actions";

const SAMPLE = `Organization\tType\tAddress\tWebsite\tContact\tEmail\tPhone
Scarsdale Public Library\tLibrary\t54 Olmsted Rd\tscarsdalelibrary.org\tJane Miller\tjane@scarsdalelibrary.org\t914-722-1300
Greenburgh Elementary\tSchool\tGreenburgh NY\t\t\t\t`;

export function ImportPartners({
  chapterId,
  existing,
}: {
  chapterId: string;
  existing: PartnerIdentity[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);

  const rows = useMemo(() => parsePartnerRows(raw), [raw]);
  const decorated = useMemo(
    () =>
      rows.map((r) => ({
        row: r,
        dup: findLikelyDuplicates(
          { name: r.name, website: r.website, contactEmail: r.contactEmail, location: r.location },
          existing
        )[0],
      })),
    [rows, existing]
  );
  const importable = decorated.filter((d) => !d.dup);

  function doImport() {
    if (importable.length === 0) return;
    startTransition(async () => {
      try {
        const res = await importChapterPartners({ chapterId, rows: importable.map((d) => d.row) });
        if (!res.ok) {
          setToast({ tone: "danger", msg: res.error });
          return;
        }
        setToast({ tone: "success", msg: `Imported ${res.created} partner${res.created === 1 ? "" : "s"}${res.skipped ? `, skipped ${res.skipped} duplicate` : ""}.` });
        setTimeout(() => router.push("/partners"), 600);
      } catch {
        setToast({ tone: "danger", msg: "Import failed." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <CardV2 padding="lg" className="flex flex-col gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-bold text-ink">Paste your research</h2>
          <p className="m-0 mt-1 text-[12.5px] text-ink-muted">
            Copy rows straight from a Google Sheet or CSV. Include a header row (Name, Type, Address, Website, Contact, Email, Phone) or use that column order.
          </p>
        </div>
        <textarea
          className="min-h-[160px] w-full resize-y rounded-[8px] border border-line-soft bg-surface px-3 py-2 font-mono text-[12.5px] text-ink focus:border-brand-500 focus:outline-none"
          placeholder={SAMPLE}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setRaw(SAMPLE)}>Load sample</Button>
          <Button variant="ghost" size="sm" onClick={() => setRaw("")}>Clear</Button>
        </div>
      </CardV2>

      {rows.length > 0 && (
        <CardV2 padding="lg" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-bold text-ink">Preview</h2>
            <span className="text-[12.5px] text-ink-muted">
              {importable.length} to import · {rows.length - importable.length} likely duplicate{rows.length - importable.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-ink-muted">
                  <th className="px-2 py-1.5 font-semibold">Name</th>
                  <th className="px-2 py-1.5 font-semibold">Type</th>
                  <th className="px-2 py-1.5 font-semibold">Contact</th>
                  <th className="px-2 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {decorated.map((d, i) => (
                  <tr key={i} className="border-t border-line-soft">
                    <td className="px-2 py-1.5 font-semibold text-ink">{d.row.name}</td>
                    <td className="px-2 py-1.5 text-ink-muted">{d.row.type ?? "—"}</td>
                    <td className="px-2 py-1.5 text-ink-muted">{d.row.contactName ?? d.row.contactEmail ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      {d.dup ? (
                        <StatusBadge tone="warning">Duplicate of {d.dup.name}</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Ready</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" loading={pending} disabled={importable.length === 0} onClick={doImport}>
              Import {importable.length} partner{importable.length === 1 ? "" : "s"}
            </Button>
            <ButtonLink href="/partners" variant="ghost" size="md">Cancel</ButtonLink>
          </div>
        </CardV2>
      )}
      {toast && <ToastV2 open tone={toast.tone}>{toast.msg}</ToastV2>}
    </div>
  );
}
