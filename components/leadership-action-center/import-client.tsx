"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { CategoryBadge, DueDateBadge, StatusBadge } from "./badges";
import {
  commitImport,
  previewImport,
} from "@/lib/leadership-action-center/actions";
import type { ParsedRow, ColumnMap } from "@/lib/leadership-action-center/import";

interface MeetingOption {
  id: string;
  title: string;
}

interface PreviewState {
  headers: string[];
  columnMap: ColumnMap;
  rows: ParsedRow[];
  skipped: Array<{ rowNumber: number; reason: string; raw: Record<string, string> }>;
  duplicateRowNumbers: number[];
}

const SAMPLE_INPUT = `Category\tItem\tDeadline\tPrimary Owners\tGet Input From\tStatus\tNeeds Officer Discussion?\tOfficer Discussion Date
Communication\tEmail summer camps about partnership\t2026-05-15\tBrayden\tAnthea\tIn Progress\tNo\t
Core Instruction\tFind Scarsdale instructor applications\t2026-05-16\tAnthea\t\tNot Started\tYes\t2026-05-18
Technology\tTest the portal for instructor signup\t2026-05-17\tBrayden\tEngineering team\tIn Progress\tNo\t
Communication\tCreate social media templates\t2026-05-19\tComms team\t\tNot Started\tNo\t
Staff Management\tCentralize parent/student/instructor records\t2026-05-20\tAnthea\tBrayden\tBlocked\tYes\t2026-05-18
Core Instruction\tFinalize interview questions\t2026-05-15\tHiring chair\tAnthea\tIn Progress\tNo\t
Communication\tDraft G&R templates\t2026-05-22\tBrayden\t\tNot Started\tYes\t2026-05-18
Communication\tCreate newsletter templates\t2026-05-23\tComms team\t\tNot Started\tNo\t`;

export default function ImportClient({
  meetings,
}: {
  meetings: MeetingOption[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [defaultMeetingId, setDefaultMeetingId] = useState("");
  const [defaultWeekStart, setDefaultWeekStart] = useState("");
  const [source, setSource] = useState<"SPREADSHEET" | "EMAIL" | "IMPORT">("SPREADSHEET");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!raw.trim()) {
      setError("Paste some rows first.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await previewImport({ raw });
        setPreview(result);
        // Default-exclude duplicates so the admin opts in to overwriting.
        setExcluded(new Set(result.duplicateRowNumbers));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse input");
      }
    });
  }

  function toggleExcluded(rowNumber: number) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function handleCommit() {
    if (!preview) return;
    const rowsToImport = preview.rows
      .filter((r) => !excluded.has(r.rowNumber))
      .map((r) => r.rowNumber);
    if (rowsToImport.length === 0) {
      setError("Nothing to import — every row is excluded.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await commitImport({
          raw,
          rowsToImport,
          defaultMeetingId: defaultMeetingId || undefined,
          defaultWeekStart: defaultWeekStart || undefined,
          source,
        });
        setSuccess(`Imported ${result.created} task${result.created === 1 ? "" : "s"}.`);
        setPreview(null);
        setRaw("");
        setExcluded(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && (
        <div
          role="alert"
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          style={{
            background: "#dcfce7",
            color: "#166534",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handlePreview} className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15 }}>1 · Paste rows</h3>
          <button
            type="button"
            className="button outline small"
            onClick={() => setRaw(SAMPLE_INPUT)}
          >
            Load sample
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
          Paste rows from a spreadsheet (tab-separated when copied from Google Sheets / Excel) or
          a comma-separated CSV. We’ll auto-detect columns called <code>Category</code>,{" "}
          <code>Item</code>, <code>Deadline</code>, <code>Primary Owners</code>,{" "}
          <code>Get Input From</code>, <code>Status</code>, and{" "}
          <code>Needs Officer Discussion?</code>.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder="Category\tItem\tDeadline\tPrimary Owners\tGet Input From\tStatus\tNeeds Officer Discussion?"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 12,
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          <button type="submit" className="button small" disabled={pending}>
            {pending ? "Parsing…" : "Parse preview"}
          </button>
        </div>
      </form>

      {preview && (
        <>
          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>2 · Detected columns</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 10px" }}>
              We mapped these columns automatically. Anything missing?{" "}
              Rename headers in the source and re-paste.
            </p>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                fontSize: 13,
              }}
            >
              {Object.entries(preview.columnMap).map(([field, header]) => (
                <div
                  key={field}
                  style={{
                    padding: "6px 10px",
                    background: header ? "#f0fdf4" : "#fef2f2",
                    color: header ? "#065f46" : "#991b1b",
                    borderRadius: 6,
                    border: `1px solid ${header ? "#bbf7d0" : "#fecaca"}`,
                  }}
                >
                  <b>{field}</b>
                  <div>→ {header ?? "not detected"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>3 · Import options</h3>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Default operating week (Mon)
                </span>
                <input
                  type="date"
                  value={defaultWeekStart}
                  onChange={(e) => setDefaultWeekStart(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Link all to meeting
                </span>
                <select
                  value={defaultMeetingId}
                  onChange={(e) => setDefaultMeetingId(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                >
                  <option value="">— None —</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Source label
                </span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                  }}
                >
                  <option value="SPREADSHEET">Spreadsheet paste</option>
                  <option value="EMAIL">Email paste</option>
                  <option value="IMPORT">Bulk import</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 18 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>4 · Review {preview.rows.length} rows</h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 0" }}>
                Uncheck rows you don&rsquo;t want to import. Duplicates of existing tasks are
                pre-excluded. Rows with warnings are still safe to import.
              </p>
              {preview.duplicateRowNumbers.length > 0 && (
                <p style={{ fontSize: 12, color: "#a16207", margin: "6px 0 0" }}>
                  {preview.duplicateRowNumbers.length} probable duplicate
                  {preview.duplicateRowNumbers.length === 1 ? "" : "s"} excluded.
                </p>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                    <th style={th}>Import?</th>
                    <th style={th}>Row</th>
                    <th style={th}>Title</th>
                    <th style={th}>Category</th>
                    <th style={th}>Status</th>
                    <th style={th}>Deadline</th>
                    <th style={th}>Owner</th>
                    <th style={th}>Input from</th>
                    <th style={th}>Officer?</th>
                    <th style={th}>Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => {
                    const isDuplicate = preview.duplicateRowNumbers.includes(row.rowNumber);
                    const isExcluded = excluded.has(row.rowNumber);
                    return (
                      <tr
                        key={row.rowNumber}
                        style={{
                          borderTop: "1px solid #e2e8f0",
                          background: isExcluded ? "#fafafa" : "#fff",
                          opacity: isExcluded ? 0.6 : 1,
                        }}
                      >
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleExcluded(row.rowNumber)}
                            aria-label={`Include row ${row.rowNumber}`}
                          />
                        </td>
                        <td style={td}>{row.rowNumber}</td>
                        <td style={td}>
                          <b style={{ color: "#0f172a" }}>{row.title}</b>
                          {isDuplicate && (
                            <div style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>
                              ⚠ Likely duplicate
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <CategoryBadge category={row.category} size="small" />
                        </td>
                        <td style={td}>
                          <StatusBadge status={row.status} />
                        </td>
                        <td style={td}>
                          <DueDateBadge dueDate={row.dueDate} />
                        </td>
                        <td style={td}>{row.primaryOwnerName ?? <span style={{ color: "#94a3b8" }}>—</span>}</td>
                        <td style={td}>
                          {row.inputNeededNames.length > 0 ? (
                            row.inputNeededNames.join(", ")
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={td}>
                          {row.needsOfficerDiscussion ? (
                            <span style={{ color: "#a16207", fontWeight: 600 }}>
                              ★ Yes
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={td}>
                          {row.warnings.length > 0 ? (
                            <span style={{ color: "#a16207", fontSize: 12 }}>
                              {row.warnings.join("; ")}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {preview.skipped.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderTop: "1px solid #e2e8f0",
                  background: "#fffbeb",
                  fontSize: 13,
                  color: "#78350f",
                }}
              >
                <b>{preview.skipped.length} rows skipped:</b>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {preview.skipped.map((s) => (
                    <li key={s.rowNumber}>
                      Row {s.rowNumber}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div
              style={{
                padding: 14,
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="button outline small"
                onClick={() => setPreview(null)}
                disabled={pending}
              >
                Discard preview
              </button>
              <button
                type="button"
                className="button small"
                onClick={handleCommit}
                disabled={pending}
              >
                {pending
                  ? "Importing…"
                  : `Import ${preview.rows.length - excluded.size} task${
                      preview.rows.length - excluded.size === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#475569",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  verticalAlign: "top",
};
