import type {
  LeadershipActionCategory,
  LeadershipActionStatus,
} from "@prisma/client";
import { parseDateInput } from "./dates";

export interface ParsedRow {
  raw: Record<string, string>;
  /** Index in the original input (1-based, matching spreadsheet row numbers). */
  rowNumber: number;
  /** Normalized fields ready to insert. Null when the column was blank. */
  title: string;
  category: LeadershipActionCategory;
  status: LeadershipActionStatus;
  dueDate: Date | null;
  primaryOwnerName: string | null;
  inputNeededNames: string[];
  needsOfficerDiscussion: boolean;
  officerDiscussionDate: Date | null;
  notes: string | null;
  warnings: string[];
}

type MappableField =
  | "title"
  | "category"
  | "status"
  | "dueDate"
  | "primaryOwner"
  | "inputNeeded"
  | "needsOfficerDiscussion"
  | "officerDiscussionDate"
  | "notes";

const HEADER_ALIASES: Record<MappableField, string[]> = {
  title: ["item", "task", "title", "action item", "action"],
  category: ["category", "track", "color"],
  status: ["status", "state"],
  dueDate: ["deadline", "due", "due date", "duedate"],
  primaryOwner: ["primary owners", "primary owner", "owner", "owners", "assignee"],
  inputNeeded: [
    "get input from",
    "input from",
    "input needed",
    "input needed from",
    "needs input from",
  ],
  needsOfficerDiscussion: [
    "needs officer discussion",
    "officer discussion",
    "discuss with officers",
    "officer discussion?",
    "needs officer discussion?",
  ],
  officerDiscussionDate: ["officer discussion date", "discussion date"],
  notes: ["notes", "blockers", "blocker", "comment", "comments", "details"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

export type ColumnMap = Record<MappableField, string | null>;

export interface ImportPreview {
  headers: string[];
  /** Mapping inferred from the headers, e.g. `{ title: "Item" }`. */
  columnMap: ColumnMap;
  rows: ParsedRow[];
  /** Rows that could not be parsed (no title, etc.) — surfaced so the admin can fix them. */
  skipped: Array<{ rowNumber: number; reason: string; raw: Record<string, string> }>;
}

function inferColumnMap(headers: string[]): ColumnMap {
  const map: Partial<ColumnMap> = {};
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));
  for (const field of Object.keys(HEADER_ALIASES) as MappableField[]) {
    const aliases = HEADER_ALIASES[field];
    const match = normalizedHeaders.find((h) => aliases.includes(h.normalized));
    map[field] = match?.original ?? null;
  }
  return map as ColumnMap;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/**
 * Parse a CSV or tab-separated string. Auto-detects delimiter (tab vs comma)
 * by counting which appears more in the first line.
 */
function splitDelimited(input: string): { headers: string[]; rows: string[][] } {
  const trimmed = input.replace(/\r/g, "").trim();
  if (!trimmed) return { headers: [], rows: [] };

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const tabCount = (lines[0].match(/\t/g) || []).length;
  const commaCount = (lines[0].match(/,/g) || []).length;
  const useTab = tabCount > commaCount;

  const splitLine = (line: string): string[] => {
    if (useTab) return line.split("\t").map((c) => c.trim());
    return parseCsvLine(line);
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map(splitLine);
  return { headers, rows };
}

function normalizeCategory(value: string | undefined): LeadershipActionCategory {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "INSTRUCTION";
  if (v.includes("instruct") || v === "pink" || v === "core instruction") return "INSTRUCTION";
  if (v.includes("tech") || v === "blue") return "TECHNOLOGY";
  if (v.includes("comm") || v === "green") return "COMMUNICATION";
  if (v.includes("staff") || v.includes("hr") || v === "purple") return "STAFF_MANAGEMENT";
  return "INSTRUCTION";
}

function normalizeStatus(value: string | undefined): LeadershipActionStatus {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "NOT_STARTED";
  if (v.includes("complete") || v === "done") return "COMPLETE";
  if (v.includes("progress") || v.includes("doing") || v.includes("active")) return "IN_PROGRESS";
  if (v.includes("block") || v.includes("stuck") || v.includes("hold")) return "BLOCKED";
  return "NOT_STARTED";
}

function normalizeBoolean(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "yes" || v === "y" || v === "true" || v === "1" || v === "x" || v === "✓";
}

function splitNames(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((s) => s.replace(/^@/, "").trim())
    .filter((s) => s.length > 0);
}

export function parseSpreadsheetInput(input: string): ImportPreview {
  const { headers, rows } = splitDelimited(input);
  if (headers.length === 0) {
    return { headers: [], columnMap: {} as ImportPreview["columnMap"], rows: [], skipped: [] };
  }

  const columnMap = inferColumnMap(headers) as ImportPreview["columnMap"];

  const parsedRows: ParsedRow[] = [];
  const skipped: ImportPreview["skipped"] = [];

  rows.forEach((cells, idx) => {
    const raw: Record<string, string> = {};
    headers.forEach((header, i) => {
      raw[header] = cells[i] ?? "";
    });

    const titleHeader = columnMap.title;
    const titleRaw = titleHeader ? raw[titleHeader]?.trim() : "";
    if (!titleRaw) {
      // Skip totally empty rows silently; flag rows that have data but no title.
      const hasAnyContent = cells.some((c) => c.trim().length > 0);
      if (hasAnyContent) {
        skipped.push({
          rowNumber: idx + 2,
          reason: "Missing task title — could not import",
          raw,
        });
      }
      return;
    }

    const warnings: string[] = [];

    const categoryRaw = columnMap.category ? raw[columnMap.category] : "";
    const statusRaw = columnMap.status ? raw[columnMap.status] : "";
    const dueRaw = columnMap.dueDate ? raw[columnMap.dueDate] : "";
    const ownerRaw = columnMap.primaryOwner ? raw[columnMap.primaryOwner] : "";
    const inputRaw = columnMap.inputNeeded ? raw[columnMap.inputNeeded] : "";
    const officerFlagRaw = columnMap.needsOfficerDiscussion
      ? raw[columnMap.needsOfficerDiscussion]
      : "";
    const officerDateRaw = columnMap.officerDiscussionDate
      ? raw[columnMap.officerDiscussionDate]
      : "";
    const notesRaw = columnMap.notes ? raw[columnMap.notes] : "";

    const dueDate = parseDateInput(dueRaw);
    if (dueRaw && !dueDate) warnings.push(`Could not parse deadline "${dueRaw}"`);

    const officerDiscussionDate = parseDateInput(officerDateRaw);
    if (officerDateRaw && !officerDiscussionDate) {
      warnings.push(`Could not parse officer discussion date "${officerDateRaw}"`);
    }

    const ownerNames = splitNames(ownerRaw);
    const inputNames = splitNames(inputRaw);

    parsedRows.push({
      raw,
      rowNumber: idx + 2,
      title: titleRaw,
      category: normalizeCategory(categoryRaw),
      status: normalizeStatus(statusRaw),
      dueDate,
      primaryOwnerName: ownerNames[0] ?? null,
      inputNeededNames: inputNames,
      needsOfficerDiscussion: normalizeBoolean(officerFlagRaw),
      officerDiscussionDate,
      notes: notesRaw?.trim() ? notesRaw.trim() : null,
      warnings,
    });
  });

  return { headers, columnMap, rows: parsedRows, skipped };
}

/** Detect rows whose title+dueDate+category match an existing item title. */
export function findDuplicateRows(
  parsed: ParsedRow[],
  existingTitles: Array<{ title: string; dueDate: Date | null; category: LeadershipActionCategory }>
): Set<number> {
  const dupes = new Set<number>();
  const existingKey = new Set(
    existingTitles.map(
      (item) =>
        `${item.title.trim().toLowerCase()}|${item.category}|${item.dueDate?.toISOString() ?? ""}`
    )
  );
  for (const row of parsed) {
    const key = `${row.title.trim().toLowerCase()}|${row.category}|${
      row.dueDate?.toISOString() ?? ""
    }`;
    if (existingKey.has(key)) dupes.add(row.rowNumber);
  }
  return dupes;
}
