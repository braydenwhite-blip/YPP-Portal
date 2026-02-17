import { put, del, head } from "@vercel/blob";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// Storage provider types
type StorageProvider = "auto" | "local" | "blob";

// Lazy client initialization
let blobConfigured: boolean | null = null;

/**
 * Get the configured storage provider
 */
function getStorageProvider(): StorageProvider {
  const raw = (process.env.STORAGE_PROVIDER || "auto").toLowerCase().trim();
  if (raw === "local" || raw === "blob" || raw === "auto") return raw;
  return "auto";
}

/**
 * Check if Vercel Blob is configured
 */
function isBlobConfigured(): boolean {
  if (blobConfigured !== null) return blobConfigured;

  // Vercel Blob requires BLOB_READ_WRITE_TOKEN
  // In Vercel deployments, this is automatically set
  blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  return blobConfigured;
}

/**
 * Check if local storage is available (development only)
 */
function isLocalStorageAvailable(): boolean {
  // Local storage only works in non-Vercel environments
  // Vercel has ephemeral filesystem, files will be lost
  return process.env.VERCEL !== "1" && process.env.NODE_ENV !== "production";
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Generate unique filename with UUID prefix
 */
function generateUniqueFilename(originalName: string): string {
  const sanitized = sanitizeFilename(originalName);
  const ext = sanitized.split(".").pop() || "bin";
  const uuid = randomUUID();
  return `${uuid}.${ext}`;
}

export interface StorageResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface UploadOptions {
  file: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Upload a file to cloud storage
 */
export async function uploadFile({
  file,
  filename,
  contentType
}: UploadOptions): Promise<StorageResult> {
  const provider = getStorageProvider();
  const uniqueFilename = generateUniqueFilename(filename);

  // Provider order:
  // - If STORAGE_PROVIDER is set, honor it
  // - Otherwise (auto), use Blob if configured and in production, else local
  const tryBlob =
    provider === "blob" ||
    (provider === "auto" && isBlobConfigured());

  const tryLocal =
    provider === "local" ||
    (provider === "auto" && !isBlobConfigured() && isLocalStorageAvailable());

  // Try Vercel Blob first (production)
  if (tryBlob) {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.warn("[Storage] BLOB_READ_WRITE_TOKEN not configured");
        // Fall through to local if in auto mode
        if (provider !== "blob") {
          // Try local as fallback
          if (tryLocal) {
            return await uploadToLocal(file, uniqueFilename);
          }
        }
        return { success: false, error: "Blob storage not configured" };
      }

      const blob = await put(uniqueFilename, file, {
        access: "public",
        contentType,
      });

      return { success: true, url: blob.url };
    } catch (error) {
      console.error("[Storage] Error uploading to Vercel Blob:", error);

      // If blob fails and we're in auto mode, try local as fallback
      if (provider === "auto" && tryLocal) {
        console.warn("[Storage] Falling back to local storage");
        return await uploadToLocal(file, uniqueFilename);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed"
      };
    }
  }

  // Use local storage (development)
  if (tryLocal) {
    return await uploadToLocal(file, uniqueFilename);
  }

  return { success: false, error: "No storage provider configured" };
}

/**
 * Upload to local disk (development only)
 */
async function uploadToLocal(
  file: Buffer,
  filename: string
): Promise<StorageResult> {
  try {
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filePath = join(uploadsDir, filename);
    await writeFile(filePath, file);

    const url = `/uploads/${filename}`;
    return { success: true, url };
  } catch (error) {
    console.error("[Storage] Error uploading to local disk:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Local upload failed"
    };
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(url: string): Promise<StorageResult> {
  const provider = getStorageProvider();

  // Determine if URL is blob or local based on the URL format
  const isBlobUrl = url.startsWith("https://") && url.includes("vercel-storage.com");
  const isLocalUrl = url.startsWith("/uploads/");

  // Delete from Vercel Blob
  if (isBlobUrl) {
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return { success: false, error: "Blob storage not configured" };
      }

      await del(url);
      return { success: true };
    } catch (error) {
      console.error("[Storage] Error deleting from Vercel Blob:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed"
      };
    }
  }

  // Delete from local disk
  if (isLocalUrl) {
    try {
      const filename = url.replace("/uploads/", "");
      const filePath = join(process.cwd(), "public", "uploads", filename);
      await unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error("[Storage] Error deleting from local disk:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed"
      };
    }
  }

  return { success: false, error: "Unknown URL format" };
}

/**
 * Get file metadata (check if file exists)
 */
export async function getFileMetadata(url: string): Promise<{
  exists: boolean;
  size?: number;
  contentType?: string;
}> {
  const isBlobUrl = url.startsWith("https://") && url.includes("vercel-storage.com");

  if (isBlobUrl) {
    try {
      const metadata = await head(url);
      return {
        exists: true,
        size: metadata.size,
        contentType: metadata.contentType
      };
    } catch {
      return { exists: false };
    }
  }

  // For local files, we could use fs.stat, but for now just return basic info
  return { exists: url.startsWith("/uploads/") };
}

/**
 * Check if storage is properly configured
 */
export function isStorageConfigured(): boolean {
  const provider = getStorageProvider();

  if (provider === "blob") return isBlobConfigured();
  if (provider === "local") return isLocalStorageAvailable();

  // Auto mode - either blob or local is ok
  return isBlobConfigured() || isLocalStorageAvailable();
}

/**
 * Get current storage provider being used
 */
export function getCurrentStorageProvider(): "blob" | "local" | "none" {
  const provider = getStorageProvider();

  if (provider === "blob" && isBlobConfigured()) return "blob";
  if (provider === "local" && isLocalStorageAvailable()) return "local";

  // Auto mode - determine what will actually be used
  if (provider === "auto") {
    if (isBlobConfigured()) return "blob";
    if (isLocalStorageAvailable()) return "local";
  }

  return "none";
}
