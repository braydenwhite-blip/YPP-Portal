"use client";

import { useState, useRef } from "react";

interface FileUploadProps {
  category: "PROFILE_PHOTO" | "ASSIGNMENT_SUBMISSION" | "TRAINING_EVIDENCE" | "OTHER";
  entityId?: string;
  entityType?: string;
  accept?: string;
  maxSizeMB?: number;
  onUploadComplete?: (file: UploadedFile) => void;
  label?: string;
  compact?: boolean;
  currentFileUrl?: string | null;
}

interface UploadedFile {
  id: string;
  url: string;
  originalName: string;
  size: number;
}

export default function FileUpload({
  category,
  entityId,
  entityType,
  accept,
  maxSizeMB = 5,
  onUploadComplete,
  label = "Upload File",
  compact = false,
  currentFileUrl,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSize = maxSizeMB * 1024 * 1024;

  const defaultAccept = category === "PROFILE_PHOTO"
    ? "image/jpeg,image/png,image/webp"
    : "image/jpeg,image/png,image/webp,application/pdf,.doc,.docx";

  const actualAccept = accept || defaultAccept;

  async function handleFile(file: File) {
    setError(null);

    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      if (entityId) formData.append("entityId", entityId);
      if (entityType) formData.append("entityType", entityType);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setUploadedFile(data);
      onUploadComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  const previewUrl = uploadedFile?.url || currentFileUrl;
  const isImage = previewUrl && (
    previewUrl.match(/\.(jpg|jpeg|png|webp|gif)$/i) ||
    category === "PROFILE_PHOTO"
  );

  if (compact) {
    return (
      <div className="upload-compact">
        <input
          ref={inputRef}
          type="file"
          accept={actualAccept}
          onChange={handleChange}
          style={{ display: "none" }}
        />
        {previewUrl && isImage && (
          <img src={previewUrl} alt="Preview" className="upload-preview-small" />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="button small outline"
          disabled={uploading}
        >
          {uploading ? "Uploading..." : uploadedFile ? "Change" : label}
        </button>
        {error && <span className="upload-error-inline">{error}</span>}
        {uploadedFile && (
          <input type="hidden" name="uploadedFileUrl" value={uploadedFile.url} />
        )}
      </div>
    );
  }

  return (
    <div className="upload-area-wrapper">
      <input
        ref={inputRef}
        type="file"
        accept={actualAccept}
        onChange={handleChange}
        style={{ display: "none" }}
      />

      {previewUrl && isImage ? (
        <div className="upload-preview-container">
          <img src={previewUrl} alt="Uploaded file" className="upload-preview" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="button small outline"
            style={{ marginTop: 8 }}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Change File"}
          </button>
        </div>
      ) : (
        <div
          className={`upload-drop-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="upload-icon">
            {category === "PROFILE_PHOTO" ? "\uD83D\uDCF7" : "\uD83D\uDCC1"}
          </div>
          <p className="upload-text">
            {uploading ? (
              "Uploading..."
            ) : (
              <>
                <strong>Click to upload</strong> or drag and drop
              </>
            )}
          </p>
          <p className="upload-hint">
            {category === "PROFILE_PHOTO"
              ? "JPG, PNG or WebP (max 5MB)"
              : `PDF, images, or documents (max ${maxSizeMB}MB)`}
          </p>
        </div>
      )}

      {uploadedFile && !isImage && (
        <div className="upload-file-info">
          <span className="upload-file-name">{uploadedFile.originalName}</span>
          <span className="upload-file-size">
            {(uploadedFile.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {uploadedFile && (
        <input type="hidden" name="uploadedFileUrl" value={uploadedFile.url} />
      )}
    </div>
  );
}
