import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Vercel Blob
vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
  head: vi.fn(),
}));

// Mock fs/promises
vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");

  return {
    ...actual,
    default: actual,
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
  };
});

async function loadStorage() {
  const storage = await import("@/lib/storage");
  const vercelBlob = await import("@vercel/blob");

  return {
    ...storage,
    vercelBlob,
  };
}

describe("Storage Abstraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset environment variables
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.STORAGE_PROVIDER;
    delete process.env.VERCEL;
    delete process.env.NODE_ENV;
  });

  describe("getCurrentStorageProvider", () => {
    it("should return 'blob' when BLOB_READ_WRITE_TOKEN is set", async () => {
      const { getCurrentStorageProvider } = await loadStorage();
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      expect(getCurrentStorageProvider()).toBe("blob");
    });

    it("should return 'local' when in development without blob token", async () => {
      const { getCurrentStorageProvider } = await loadStorage();
      process.env.NODE_ENV = "development";
      process.env.VERCEL = undefined;
      expect(getCurrentStorageProvider()).toBe("local");
    });

    it("should return 'none' when in production without blob token", async () => {
      const { getCurrentStorageProvider } = await loadStorage();
      process.env.NODE_ENV = "production";
      expect(getCurrentStorageProvider()).toBe("none");
    });
  });

  describe("isStorageConfigured", () => {
    it("should return true when Blob is configured", async () => {
      const { isStorageConfigured } = await loadStorage();
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      expect(isStorageConfigured()).toBe(true);
    });

    it("should return true when local storage is available", async () => {
      const { isStorageConfigured } = await loadStorage();
      process.env.NODE_ENV = "development";
      expect(isStorageConfigured()).toBe(true);
    });

    it("should return false when no storage is configured", async () => {
      const { isStorageConfigured } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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

      // Verify the filename was reduced to a safe generated name.
      const callArgs = vi.mocked(vercelBlob.put).mock.calls[0];
      expect(callArgs[0]).toMatch(/^[a-f0-9-]+\.bin$/);
    });
  });

  describe("deleteFile", () => {
    it("should delete file from Vercel Blob", async () => {
      const { deleteFile, vercelBlob } = await loadStorage();
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";
      vi.mocked(vercelBlob.del).mockResolvedValue(undefined as any);

      const blobUrl = "https://test.vercel-storage.com/file.jpg";
      const result = await deleteFile(blobUrl);

      expect(result.success).toBe(true);
      expect(vercelBlob.del).toHaveBeenCalledWith(blobUrl);
    });

    it("should return error when blob URL is invalid", async () => {
      const { deleteFile } = await loadStorage();
      process.env.BLOB_READ_WRITE_TOKEN = "test-token";

      const invalidUrl = "not-a-blob-url";
      const result = await deleteFile(invalidUrl);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown URL format");
    });

    it("should handle deletion errors gracefully", async () => {
      const { deleteFile, vercelBlob } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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
      const { uploadFile, vercelBlob } = await loadStorage();
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
