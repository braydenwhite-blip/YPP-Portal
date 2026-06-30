/**
 * Parse pasted partner research (CSV / TSV from Google Sheets) into rows the
 * import action can consume (Partner Automation, Phase 1). Pure + testable.
 *
 * Supports a header row (mapped by column-name aliases) or, when no header is
 * present, the positional default order:
 *   name, type, location, website, contactName, contactTitle, contactEmail, contactPhone, notes
 */

export type ParsedImportRow = {
  name: string;
  type?: string;
  location?: string;
  website?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
};

type Field = keyof ParsedImportRow;

const POSITIONAL: Field[] = [
  "name",
  "type",
  "location",
  "website",
  "contactName",
  "contactTitle",
  "contactEmail",
  "contactPhone",
  "notes",
];

const HEADER_ALIASES: Record<string, Field> = {
  name: "name",
  organization: "name",
  org: "name",
  partner: "name",
  school: "name",
  type: "type",
  category: "type",
  address: "location",
  location: "location",
  city: "location",
  website: "website",
  url: "website",
  site: "website",
  contact: "contactName",
  "contact name": "contactName",
  "main contact": "contactName",
  title: "contactTitle",
  "contact title": "contactTitle",
  role: "contactTitle",
  email: "contactEmail",
  "contact email": "contactEmail",
  phone: "contactPhone",
  "contact phone": "contactPhone",
  tel: "contactPhone",
  notes: "notes",
  note: "notes",
};

export function detectDelimiter(text: string): "\t" | "," {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  if (firstLine.includes("\t")) return "\t";
  return ",";
}

/** Split one line into cells, honoring simple double-quoted fields. */
function splitLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

/** Decide whether the first row is a header (its cells map to known fields). */
function headerMapping(cells: string[]): Field[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[c.toLowerCase().trim()]);
  const named = mapped.filter((m) => m === "name").length;
  const known = mapped.filter(Boolean).length;
  // A header should name the partner column and mostly map to known fields.
  if (named >= 1 && known >= Math.ceil(cells.length / 2)) {
    return mapped.map((m, i) => m ?? POSITIONAL[i] ?? "notes");
  }
  return null;
}

export function parsePartnerRows(text: string): ParsedImportRow[] {
  const delim = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstCells = splitLine(lines[0], delim);
  const mapping = headerMapping(firstCells);
  const dataLines = mapping ? lines.slice(1) : lines;
  const fields = mapping ?? POSITIONAL;

  const rows: ParsedImportRow[] = [];
  for (const line of dataLines) {
    const cells = splitLine(line, delim);
    const row: ParsedImportRow = { name: "" };
    cells.forEach((value, i) => {
      const field = fields[i];
      if (field && value) (row as Record<string, string>)[field] = value;
    });
    if (row.name.trim().length > 0) rows.push(row);
  }
  return rows;
}
