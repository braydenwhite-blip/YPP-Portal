/**
 * Codemod script to replace NextAuth getServerSession with Supabase auth getSession.
 *
 * What it does:
 * 1. Replaces `import { getServerSession } from "next-auth"` with `import { getSession } from "@/lib/auth-supabase"`
 * 2. Removes `import { authOptions } from "@/lib/auth"`
 * 3. Replaces `getServerSession(authOptions)` with `getSession()`
 * 4. Replaces `await getServerSession(authOptions)` with `await getSession()`
 *
 * Usage:
 *   node scripts/codemod-supabase-auth.mjs              # dry-run
 *   node scripts/codemod-supabase-auth.mjs --execute     # apply changes
 */

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const isDryRun = !process.argv.includes("--execute");

function findFiles(dir, pattern, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git", "prisma"].includes(entry.name)) continue;
      findFiles(fullPath, pattern, results);
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findFiles(ROOT, /\.(ts|tsx)$/);
let modified = 0;
let skipped = 0;

for (const filePath of files) {
  const rel = path.relative(ROOT, filePath);

  // Skip files we've already manually updated
  if (
    rel === "lib/authorization.ts" ||
    rel === "lib/auth.ts" ||
    rel === "lib/auth-supabase.ts" ||
    rel === "middleware.ts" ||
    rel.startsWith("lib/supabase/") ||
    rel.startsWith("scripts/")
  ) {
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  const original = content;

  // Check if this file uses getServerSession or authOptions from next-auth
  if (
    !content.includes("getServerSession") &&
    !content.includes('from "next-auth"') &&
    !content.includes('from "@/lib/auth"')
  ) {
    continue;
  }

  // 1. Replace `import { getServerSession } from "next-auth"` (with possible other imports)
  //    Handle: import { getServerSession } from "next-auth";
  //    Handle: import { getServerSession } from "next-auth/next";
  content = content.replace(
    /import\s*\{\s*getServerSession\s*\}\s*from\s*["']next-auth(?:\/next)?["'];?\n?/g,
    ""
  );

  // 2. Remove `import { authOptions } from "@/lib/auth"`
  content = content.replace(
    /import\s*\{\s*authOptions\s*\}\s*from\s*["']@\/lib\/auth["'];?\n?/g,
    ""
  );

  // Also remove authOptions from combined imports like `import { authOptions, something } from "@/lib/auth"`
  content = content.replace(
    /import\s*\{([^}]*),?\s*authOptions\s*,?([^}]*)\}\s*from\s*["']@\/lib\/auth["'];?\n?/g,
    (match, before, after) => {
      const remaining = [before.trim(), after.trim()].filter(Boolean).join(", ");
      if (!remaining || remaining === ",") return "";
      return `import { ${remaining} } from "@/lib/auth";\n`;
    }
  );

  // 3. Replace getServerSession(authOptions) with getSession()
  content = content.replace(/getServerSession\s*\(\s*authOptions\s*\)/g, "getSession()");

  // 4. If we made changes, add the getSession import if not already present
  if (content !== original && content.includes("getSession()") && !content.includes('from "@/lib/auth-supabase"')) {
    // Find the first import statement and add after it
    const firstImportMatch = content.match(/^import\s.+;?\n/m);
    if (firstImportMatch) {
      const insertPos = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
      content =
        content.slice(0, insertPos) +
        'import { getSession } from "@/lib/auth-supabase";\n' +
        content.slice(insertPos);
    } else {
      content = 'import { getSession } from "@/lib/auth-supabase";\n' + content;
    }
  }

  if (content !== original) {
    if (isDryRun) {
      console.log(`[DRY] Would modify: ${rel}`);
    } else {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`[MOD] ${rel}`);
    }
    modified++;
  } else {
    skipped++;
  }
}

console.log(`\nDone. Modified: ${modified}, Skipped (no changes needed): ${skipped}`);
if (isDryRun) {
  console.log("This was a dry run. Pass --execute to apply changes.");
}
