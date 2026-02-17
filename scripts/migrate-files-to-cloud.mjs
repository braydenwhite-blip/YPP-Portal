#!/usr/bin/env node
/**
 * Migrate local files from public/uploads/ to cloud storage (Vercel Blob)
 *
 * Usage:
 *   node scripts/migrate-files-to-cloud.mjs [--dry-run] [--delete-local]
 *
 * Options:
 *   --dry-run       Preview what would be migrated without making changes
 *   --delete-local  Delete local files after successful upload (default: keep them)
 *
 * Prerequisites:
 *   - BLOB_READ_WRITE_TOKEN must be set in environment
 *   - Database must be accessible (DATABASE_URL or DIRECT_URL)
 */

import { readdir, readFile, unlink, stat } from "fs/promises";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteLocal = args.includes("--delete-local");

const prisma = new PrismaClient();

// ANSI color codes for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m"
};

function log(message, color = "") {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logDebug(message) {
  log(`  ${message}`, colors.gray);
}

async function migrateFiles() {
  log("\n" + "=".repeat(60), colors.bright);
  log("  File Migration: Local → Cloud Storage (Vercel Blob)", colors.bright);
  log("=".repeat(60) + "\n", colors.bright);

  // Check prerequisites
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logError("BLOB_READ_WRITE_TOKEN not set in environment");
    logInfo("Set this variable in your .env file or Vercel dashboard");
    process.exit(1);
  }

  if (dryRun) {
    logWarning("DRY RUN MODE - No changes will be made");
  }

  // Get local uploads directory
  const uploadsDir = join(process.cwd(), "public", "uploads");

  try {
    await stat(uploadsDir);
  } catch {
    logWarning(`No uploads directory found at: ${uploadsDir}`);
    logInfo("Nothing to migrate");
    process.exit(0);
  }

  // Get all files from database
  logInfo("Fetching file records from database...");
  const fileRecords = await prisma.fileUpload.findMany({
    where: {
      url: {
        startsWith: "/uploads/"
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (fileRecords.length === 0) {
    logWarning("No local file records found in database");
    logInfo("All files may already be migrated to cloud storage");
    process.exit(0);
  }

  logInfo(`Found ${fileRecords.length} file(s) to migrate\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const errors = [];

  // Migrate each file
  for (const [index, record] of fileRecords.entries()) {
    const filename = record.url.replace("/uploads/", "");
    const localPath = join(uploadsDir, filename);
    const progress = `[${index + 1}/${fileRecords.length}]`;

    log(`${progress} ${filename}`, colors.bright);

    try {
      // Check if local file exists
      try {
        await stat(localPath);
      } catch {
        logWarning(`  Local file not found, skipping`);
        logDebug(`  Database ID: ${record.id}`);
        skippedCount++;
        continue;
      }

      // Read file
      const fileBuffer = await readFile(localPath);
      const fileSizeKB = (fileBuffer.length / 1024).toFixed(2);
      logDebug(`  Size: ${fileSizeKB} KB`);
      logDebug(`  Content-Type: ${record.mimeType}`);

      if (dryRun) {
        logInfo(`  Would upload to Vercel Blob`);
        successCount++;
        continue;
      }

      // Upload to Vercel Blob
      const blob = await put(filename, fileBuffer, {
        access: "public",
        contentType: record.mimeType
      });

      logDebug(`  Blob URL: ${blob.url}`);

      // Update database record
      await prisma.fileUpload.update({
        where: { id: record.id },
        data: { url: blob.url }
      });

      logSuccess(`  Migrated successfully`);

      // Delete local file if requested
      if (deleteLocal) {
        await unlink(localPath);
        logDebug(`  Deleted local file`);
      }

      successCount++;

    } catch (error) {
      errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(`  Migration failed: ${errorMsg}`);
      errors.push({ filename, error: errorMsg });
    }

    // Add spacing between files (except for last one)
    if (index < fileRecords.length - 1) {
      console.log("");
    }
  }

  // Summary
  log("\n" + "=".repeat(60), colors.bright);
  log("  Migration Summary", colors.bright);
  log("=".repeat(60) + "\n", colors.bright);

  log(`Total files:     ${fileRecords.length}`);
  logSuccess(`Migrated:        ${successCount}`);
  if (skippedCount > 0) {
    logWarning(`Skipped:         ${skippedCount} (local file not found)`);
  }
  if (errorCount > 0) {
    logError(`Failed:          ${errorCount}`);
  }

  if (errors.length > 0) {
    log("\nErrors:", colors.red);
    errors.forEach(({ filename, error }) => {
      log(`  ${filename}: ${error}`, colors.red);
    });
  }

  if (dryRun) {
    log("\nDRY RUN COMPLETE - No changes were made", colors.yellow);
    log("Run without --dry-run to perform actual migration", colors.yellow);
  } else if (successCount > 0) {
    log("\nMigration complete!", colors.green);
    if (!deleteLocal) {
      log("Local files were kept (use --delete-local to remove them)", colors.gray);
    }
  }

  log("");

  await prisma.$disconnect();

  process.exit(errorCount > 0 ? 1 : 0);
}

// Run migration
migrateFiles().catch((error) => {
  logError(`\nFatal error: ${error.message}`);
  console.error(error);
  prisma.$disconnect();
  process.exit(1);
});
