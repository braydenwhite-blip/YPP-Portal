"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importChapterStudentCsvRows } from "@/lib/csv-import-actions";
import { normalizeCsvHeader, parseCsv } from "@/lib/csv-parse";
import { Button, ModalFooterV2, ModalV2, cn } from "@/components/ui-v2";

type FieldKey = "email" | "name" | "lastName" | "grade" | "school" | "parentEmail" | "phone" | "className";

type ChapterClassOption = {
  id: string;
  title: string;
  semester: string | null;
};

const FIELDS: Array<{ key: FieldKey; label: string; required?: boolean }> = [
  { key: "email", label: "Email", required: true },
  { key: "name", label: "Full name" },
  { key: "lastName", label: "Last name" },
  { key: "className", label: "Class" },
  { key: "grade", label: "Grade" },
  { key: "school", label: "School" },
  { key: "parentEmail", label: "Parent email" },
  { key: "phone", label: "Phone" },
];

const ALIASES: Record<FieldKey, string[]> = {
  email: ["email", "e mail", "email address"],
  name: ["name", "full name", "first name", "firstname"],
  lastName: ["last name", "lastname", "surname", "family name"],
  grade: ["grade", "year"],
  school: ["school", "school name"],
  parentEmail: ["parent email", "guardian email", "parent"],
  phone: ["phone", "mobile", "cell"],
  className: ["class", "class name", "course", "offering"],
};

const EMPTY_MAP: Record<FieldKey, number> = {
  email: -1,
  name: -1,
  lastName: -1,
  grade: -1,
  school: -1,
  parentEmail: -1,
  phone: -1,
  className: -1,
};

const TEMPLATE = "email,name,lastName,class,grade,school,parentEmail\n";

const selectClass =
  "h-8 w-full rounded-[8px] border border-line bg-surface px-2 text-[12.5px] text-ink";

function guessIndex(headers: string[], key: FieldKey): number {
  const aliases = ALIASES[key];
  return headers.findIndex((h) => aliases.includes(normalizeCsvHeader(h)));
}

export function ChapterStudentCsvImport({
  classes,
}: {
  classes: ChapterClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [offeringId, setOfferingId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<FieldKey, number>>(EMPTY_MAP);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function resetFile() {
    setHeaders([]);
    setRows([]);
    setResult(null);
    setFileError(null);
  }

  function onFile(file: File | undefined) {
    resetFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setFileError("That CSV is empty. Include a header row and at least one student.");
        return;
      }
      if (parsed.rows.length > 200) {
        setFileError("Import up to 200 rows at a time.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMap({
        email: guessIndex(parsed.headers, "email"),
        name: guessIndex(parsed.headers, "name"),
        lastName: guessIndex(parsed.headers, "lastName"),
        grade: guessIndex(parsed.headers, "grade"),
        school: guessIndex(parsed.headers, "school"),
        parentEmail: guessIndex(parsed.headers, "parentEmail"),
        phone: guessIndex(parsed.headers, "phone"),
        className: guessIndex(parsed.headers, "className"),
      });
    };
    reader.readAsText(file);
  }

  function cell(row: string[], index: number) {
    return index >= 0 ? (row[index] ?? "").trim() : "";
  }

  function importRows() {
    setFileError(null);
    const payload = rows.map((row) => {
      const name = cell(row, map.name);
      let lastName = cell(row, map.lastName);
      if (!lastName && name) lastName = name.split(/\s+/).pop() ?? "";
      return {
        email: cell(row, map.email).toLowerCase(),
        name,
        lastName,
        grade: cell(row, map.grade),
        school: cell(row, map.school),
        parentEmail: cell(row, map.parentEmail),
        phone: cell(row, map.phone),
        className: cell(row, map.className),
      };
    });
    startTransition(async () => {
      const res = await importChapterStudentCsvRows({ offeringId, rows: payload });
      setResult(res);
      if (res.imported > 0) router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Import CSV
      </Button>
      <ModalV2
        open={open}
        onClose={() => !pending && setOpen(false)}
        locked={pending}
        labelledBy="chapter-student-csv-title"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div>
            <h2 id="chapter-student-csv-title" className="m-0 text-[18px] font-bold text-ink">
              Import students into classes
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Upload a CSV to add students to this chapter. Pick a class below, or include a class column.
            </p>
          </div>

          <label className="text-[13px] font-medium text-ink">
            Enroll in class
            <select
              className={cn(selectClass, "mt-1")}
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
            >
              <option value="">Don’t enroll — add to chapter only</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.title}
                  {cls.semester ? ` · ${cls.semester}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[13px] font-medium text-ink">
              CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="mt-1 block text-[13px]"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
              download="chapter-students.csv"
              className="text-[12.5px] font-semibold text-brand-700 no-underline hover:underline"
            >
              Download template
            </a>
          </div>

          {fileError ? (
            <p className="m-0 rounded-[10px] bg-blocked-50 px-3 py-2 text-[13px] text-blocked-700">
              {fileError}
            </p>
          ) : null}

          {headers.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-[12.5px] text-ink-muted">
                {rows.length} row{rows.length === 1 ? "" : "s"} · match each field to a column
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((field) => (
                  <label key={field.key} className="text-[12px] font-medium text-ink">
                    {field.label}
                    {field.required ? " *" : ""}
                    <select
                      className={cn(selectClass, "mt-1")}
                      value={map[field.key]}
                      onChange={(e) =>
                        setMap((current) => ({ ...current, [field.key]: Number(e.target.value) }))
                      }
                    >
                      <option value={-1}>Skip</option>
                      {headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={index}>
                          {header || `Column ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {result ? (
            <div className="rounded-[10px] border border-line-card bg-surface-soft px-3 py-2 text-[13px] text-ink">
              <p className="m-0 font-semibold">
                Imported {result.imported}
                {result.skipped ? ` · skipped ${result.skipped}` : ""}
              </p>
              {result.errors.length > 0 ? (
                <ul className="mb-0 mt-2 list-disc pl-4 text-[12.5px] text-ink-muted">
                  {result.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <ModalFooterV2>
            <Button type="button" variant="secondary" size="md" onClick={() => setOpen(false)}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={pending}
              disabled={rows.length === 0 || map.email < 0}
              onClick={importRows}
            >
              Import
            </Button>
          </ModalFooterV2>
        </div>
      </ModalV2>
    </>
  );
}
