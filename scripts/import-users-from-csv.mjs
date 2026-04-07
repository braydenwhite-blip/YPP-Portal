#!/usr/bin/env node
/**
 * v1 migration helper: validate a CSV of users before import.
 * Does not write to DB by default — use as a lint step; extend with Prisma creates when ready.
 *
 * Usage:
 *   node scripts/import-users-from-csv.mjs --file=./users.csv
 *
 * Expected header columns: email,name,primaryRole,chapterName (chapterName optional)
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const RoleEnum = z.enum([
  "STUDENT",
  "INSTRUCTOR",
  "MENTOR",
  "ADMIN",
  "CHAPTER_PRESIDENT",
  "STAFF",
  "APPLICANT",
]);

const RowSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  primaryRole: RoleEnum,
  chapterName: z.string().optional(),
});

function parseArgs(argv) {
  let file = "";
  for (const token of argv) {
    if (token.startsWith("--file=")) {
      file = token.slice(7).trim();
    }
  }
  return { file };
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(",");
    const record = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });
  return { headers, rows };
}

const { file } = parseArgs(process.argv.slice(2));
if (!file) {
  console.error("Usage: node scripts/import-users-from-csv.mjs --file=./users.csv");
  process.exit(1);
}

const abs = path.resolve(process.cwd(), file);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

const { rows } = parseCsv(fs.readFileSync(abs, "utf8"));
const errors = [];
const valid = [];

rows.forEach((row, index) => {
  const parsed = RowSchema.safeParse(row);
  if (!parsed.success) {
    errors.push({ line: index + 2, issues: parsed.error.flatten() });
  } else {
    valid.push(parsed.data);
  }
});

console.log(`[import-users-from-csv] ${valid.length} valid row(s), ${errors.length} error(s).`);
if (errors.length) {
  console.error(JSON.stringify(errors.slice(0, 20), null, 2));
  process.exit(1);
}

console.log("All rows valid. Next: resolve chapterName → chapterId, hash passwords, Prisma batch insert (not implemented in this stub).");
