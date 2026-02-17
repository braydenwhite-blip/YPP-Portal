import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadFile, deleteFile, isStorageConfigured, getCurrentStorageProvider } from "@/lib/storage";
import * as vercelBlob from "@vercel/blob";

// Mock Vercel Blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  head: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
}));

describe("Storage Abstraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.STORAGE_PROVIDER;
    delete process.env.VERCEL;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCurrentStorageProvider", () => {
    it("should return 'blob' when BLOB_READ_WRITE_TOKEN is set", () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      expect(getCurrentStorageProvider()).toBe("blob");
    });

    it("should return 'local' when in development without blob token", () => {
      process.env.NODE_ENV = "development";
      process.env.VERCEL = undefined;
      expect(getCurrentStorageProvider()).toBe("local");
    });

    it("should return 'none' when in production without blob token", () => {
      process.env.NODE_ENV = "production";
      expect(getCurrentStorageProvider()).toBe("none");
    });
  });

  describe("isStorageConfigured", () => {
    it("should return true when Blob is configured", () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      expect(isStorageConfigured()).toBe(true);
    });

    it("should return true when local storage is available", () => {
      process.env.NODE_ENV = "development";
      expect(isStorageConfigured()).toBe(true);
    });

    it("should return false when no storage is configured", () => {
      process.env.NODE_ENV = "production";
      process.env.VERCEL = "1";
      expect(isStorageConfigured()).toBe(false);
    });
  });

  describe("uploadFile with Vercel Blob", () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    });

    it("should upload file to Vercel Blob successfully", async () => {
      const mockBlobUrl = "https://test.vercel-storage.com/file.jpg";
      vi.mocked(vercelBlob.put).mockResolvedValue({
        url: mockBlobUrl,
        pathname: "file.jpg",
        contentType: "image/jpeg",
        contentDisposition: "inline",
      } as any);

      const buffer = Buffer.from("test file content");
      const result = await uploadFile({
        file: buffer,
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe(mockBlobUrl);
      expect(vercelBlob.put).toHaveBeenCalled();
    });

    it("should return error when Blob upload fails", async () => {
      vi.mocked(vercelBlob.put).mockRejectedValue(new Error("Upload failed"));

      const buffer = Buffer.from("test file content");
      const result = await uploadFile({
        file: buffer,
        filename: "test.jpg",
        contentType: "image/jpeg",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Upload failed");
    });

    it("should sanitize filenames", async () => {
      const mockBlobUrl = "https://test.vercel-storage.com/file.jpg";
      vi.mocked(vercelBlob.put).mockResolvedValue({
        url: mockBlobUrl,
      } as any);

      const buffer = Buffer.from("test");
      await uploadFile({
        file: buffer,
        filename: "../../../etc/passwd",
        contentType: "text/plain",
      });

      // Verify the filename was sanitized (no path traversal)
      const callArgs = vi.mocked(vercelBlob.put).mock.calls[0];
      expect(callArgs[0]).toMatch(/^[a-f0-9-]+\.passwd$/); // UUID-based filename
    });
  });

  describe("deleteFile", () => {
    it("should delete file from Vercel Blob", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.del).mockResolvedValue(undefined as any);

      const blobUrl = "https://test.vercel-storage.com/file.jpg";
      const result = await deleteFile(blobUrl);

      expect(result.success).toBe(true);
      expect(vercelBlob.del).toHaveBeenCalledWith(blobUrl);
    });

    it("should return error when blob URL is invalid", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";

      const invalidUrl = "not-a-blob-url";
      const result = await deleteFile(invalidUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown URL format");
    });

    it("should handle deletion errors gracefully", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.del).mockRejectedValue(new Error("Delete failed"));

      const blobUrl = "https://test.vercel-storage.com/file.jpg";
      const result = await deleteFile(blobUrl);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Delete failed");
    });
  });

  describe("Filename generation", () => {
    it("should generate unique filenames with UUID", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.put).mockResolvedValue({
        url: "https://test.vercel-storage.com/file.jpg",
      } as any);

      const buffer = Buffer.from("test");

      // Upload same file twice
      await uploadFile({ file: buffer, filename: "test.jpg", contentType: "image/jpeg" });
      await uploadFile({ file: buffer, filename: "test.jpg", contentType: "image/jpeg" });

      // Verify both calls used different filenames (UUID-based)
      const call1 = vi.mocked(vercelBlob.put).mock.calls[0][0];
      const call2 = vi.mocked(vercelBlob.put).mock.calls[1][0];

      expect(call1).not.toBe(call2);
      expect(call1).toMatch(/^[a-f0-9-]+\.jpg$/);
      expect(call2).toMatch(/^[a-f0-9-]+\.jpg$/);
    });

    it("should preserve file extensions", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.put).mockResolvedValue({
        url: "https://test.vercel-storage.com/file.pdf",
      } as any);

      const buffer = Buffer.from("test");
      await uploadFile({ file: buffer, filename: "document.pdf", contentType: "application/pdf" });

      const filename = vi.mocked(vercelBlob.put).mock.calls[0][0];
      expect(filename).toMatch(/\.pdf$/);
    });

    it("should handle files without extensions", async () => {
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.put).mockResolvedValue({
        url: "https://test.vercel-storage.com/file",
      } as any);

      const buffer = Buffer.from("test");
      await uploadFile({ file: buffer, filename: "noextension", contentType: "application/octet-stream" });

      const filename = vi.mocked(vercelBlob.put).mock.calls[0][0];
      expect(filename).toMatch(/^[a-f0-9-]+\.bin$/); // Uses .bin as fallback
    });
  });
});
