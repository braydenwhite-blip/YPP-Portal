"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { importApplicantCsvRows, importStudentCsvRows } from "@/lib/csv-import-actions";
import { normalizeCsvHeader, parseCsv } from "@/lib/csv-parse";
import { Button, ModalFooterV2, ModalV2, cn } from "@/components/ui-v2";

type Role = "instructor" | "cp" | "staff" | "student";
type FieldKey =
  | "email"
  | "name"
  | "lastName"
  | "chapter"
  | "phone"
  | "city"
  | "state"
  | "country"
  | "track"
  | "grade"
  | "school"
  | "parentEmail";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "instructor", label: "Instructor" },
  { value: "cp", label: "Chapter President" },
  { value: "staff", label: "Social Media Manager" },
  { value: "student", label: "Student" },
];

const FIELDS: Array<{ key: FieldKey; label: string; required?: boolean; kinds?: Role[] }> = [
  { key: "email", label: "Email", required: true },
  { key: "name", label: "Full name" },
  { key: "lastName", label: "Last name" },
  { key: "chapter", label: "Chapter / location" },
  { key: "grade", label: "Grade", kinds: ["student"] },
  { key: "school", label: "School", kinds: ["student"] },
  { key: "parentEmail", label: "Parent email", kinds: ["student"] },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City", kinds: ["instructor", "cp", "staff"] },
  { key: "state", label: "State", kinds: ["instructor", "cp", "staff"] },
  { key: "country", label: "Country", kinds: ["instructor", "cp", "staff"] },
  { key: "track", label: "Instructor track", kinds: ["instructor"] },
];

const ALIASES: Record<FieldKey, string[]> = {
  email: ["email", "e mail", "email address"],
  name: ["name", "full name", "first name", "firstname"],
  lastName: ["last name", "lastname", "surname", "family name"],
  chapter: ["chapter", "chapter name", "location"],
  phone: ["phone", "mobile", "cell"],
  city: ["city"],
  state: ["state", "state province", "province"],
  country: ["country"],
  track: ["track", "instructor track", "type"],
  grade: ["grade", "year", "class"],
  school: ["school", "school name"],
  parentEmail: ["parent email", "guardian email", "parent"],
};

const selectClass =
  "h-8 w-full rounded-[8px] border border-line bg-surface px-2 text-[12.5px] text-ink";

function guessIndex(headers: string[], key: FieldKey): number {
  const aliases = ALIASES[key];
  return headers.findIndex((h) => aliases.includes(normalizeCsvHeader(h)));
}

function templateCsv(role: Role): string {
  if (role === "student") return "email,name,lastName,chapter,grade,school,parentEmail\n";
  if (role === "staff") return "email,name,lastName,chapter\n";
  if (role === "cp") return "email,name,lastName,chapter,city,state,country\n";
  return "email,name,lastName,chapter,track,city,state,country\n";
}

const EMPTY_MAP: Record<FieldKey, number> = {
  email: -1,
  name: -1,
  lastName: -1,
  chapter: -1,
  phone: -1,
  city: -1,
  state: -1,
  country: -1,
  track: -1,
  grade: -1,
  school: -1,
  parentEmail: -1,
};

export function ApplicantCsvImport({
  enabled,
  kinds = ["instructor", "cp", "staff", "student"],
  defaultRole,
}: {
  enabled: boolean;
  kinds?: Role[];
  defaultRole?: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>(defaultRole ?? kinds[0] ?? "instructor");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<FieldKey, number>>(EMPTY_MAP);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const roleChoices = ROLE_OPTIONS.filter((option) => kinds.includes(option.value));
  const visibleFields = useMemo(
    () => FIELDS.filter((field) => !field.kinds || field.kinds.includes(role)),
    [role]
  );
  const isStudent = role === "student";

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
        setFileError(
          isStudent
            ? "That CSV is empty. Include a header row and at least one student."
            : "That CSV is empty. Include a header row and at least one applicant."
        );
        return;
      }
      if (parsed.rows.length > 200) {
        setFileError("Import up to 200 rows at a time.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMap({
        ...EMPTY_MAP,
        email: guessIndex(parsed.headers, "email"),
        name: guessIndex(parsed.headers, "name"),
        lastName: guessIndex(parsed.headers, "lastName"),
        chapter: guessIndex(parsed.headers, "chapter"),
        phone: guessIndex(parsed.headers, "phone"),
        city: guessIndex(parsed.headers, "city"),
        state: guessIndex(parsed.headers, "state"),
        country: guessIndex(parsed.headers, "country"),
        track: guessIndex(parsed.headers, "track"),
        grade: guessIndex(parsed.headers, "grade"),
        school: guessIndex(parsed.headers, "school"),
        parentEmail: guessIndex(parsed.headers, "parentEmail"),
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
        chapter: cell(row, map.chapter),
        phone: cell(row, map.phone),
        city: cell(row, map.city),
        state: cell(row, map.state),
        country: cell(row, map.country),
        track: cell(row, map.track),
        grade: cell(row, map.grade),
        school: cell(row, map.school),
        parentEmail: cell(row, map.parentEmail),
      };
    });
    startTransition(async () => {
      const res = isStudent
        ? await importStudentCsvRows({ rows: payload })
        : await importApplicantCsvRows({ role, rows: payload });
      setResult(res);
      if (res.imported > 0) router.refresh();
    });
  }

  if (!enabled) return null;

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Import CSV
      </Button>
      <ModalV2
        open={open}
        onClose={() => !pending && setOpen(false)}
        locked={pending}
        labelledBy="csv-import-title"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div>
            <h2 id="csv-import-title" className="m-0 text-[18px] font-bold text-ink">
              {isStudent ? "Import students" : "Import applicants"}
            </h2>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              {isStudent
                ? "Upload a CSV. We’ll match columns, then create student accounts."
                : "Upload a CSV. We’ll match columns, then add them to the board."}
            </p>
          </div>

          {roleChoices.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {roleChoices.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold",
                    role === value
                      ? "border-brand-500 bg-brand-600 text-white"
                      : "border-line-soft bg-surface text-ink-muted hover:text-ink"
                  )}
                  onClick={() => {
                    setRole(value);
                    resetFile();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

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
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(role))}`}
              download={isStudent ? "students.csv" : `${role}-applicants.csv`}
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
                {visibleFields.map((field) => (
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
