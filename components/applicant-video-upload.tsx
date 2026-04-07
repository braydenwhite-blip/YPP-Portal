"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";
import {
  APPLICANT_VIDEO_ACCEPT,
  APPLICANT_VIDEO_MAX_DURATION_SECONDS,
  APPLICANT_VIDEO_MAX_SIZE_BYTES,
  APPLICANT_VIDEO_STORAGE_PREFIX,
  isApplicantVideoFileAllowed,
  sanitizeUploadFilename,
} from "@/lib/applicant-video-upload";

interface UploadedApplicantVideo {
  url: string;
  originalName: string;
  size: number;
}

interface ApplicantVideoUploadProps {
  name?: string;
  onUploadComplete?: (file: UploadedApplicantVideo) => void;
  onUploadStateChange?: (uploading: boolean) => void;
}

interface UploadModeResponse {
  mode: "client" | "server";
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  return `${mb.toFixed(1)} MB`;
}

function buildPathname(filename: string) {
  return `${APPLICANT_VIDEO_STORAGE_PREFIX}/${Date.now()}-${sanitizeUploadFilename(filename)}`;
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "We couldn't upload that video. Please try again.";
}

async function getVideoDuration(file: File) {
  return await new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();

      if (!Number.isFinite(duration)) {
        reject(new Error("We couldn't read the video length. Please try a different file."));
        return;
      }

      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("We couldn't read that video file. Please try another MP4, MOV, or WebM file."));
    };
    video.src = objectUrl;
  });
}

export default function ApplicantVideoUpload({
  name = "motivationVideoUrl",
  onUploadComplete,
  onUploadStateChange,
}: ApplicantVideoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedApplicantVideo | null>(null);

  async function getUploadMode() {
    const response = await fetch("/api/upload/applicant-video", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("We couldn't prepare the upload. Please refresh and try again.");
    }

    return (await response.json()) as UploadModeResponse;
  }

  async function uploadThroughServer(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload/applicant-video", {
      method: "POST",
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string" && data.error
          ? data.error
          : "We couldn't upload that video. Please try again."
      );
    }

    return {
      url: String(data.url),
      originalName: file.name,
      size: file.size,
    };
  }

  async function uploadThroughBlob(file: File) {
    const blob = await upload(buildPathname(file.name), file, {
      access: "public",
      contentType: file.type || "video/mp4",
      handleUploadUrl: "/api/upload/applicant-video",
      multipart: file.size > 20 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => {
        setUploadProgress(Math.round(percentage));
      },
    });

    return {
      url: blob.url,
      originalName: file.name,
      size: file.size,
    };
  }

  async function handleFile(file: File) {
    setError(null);

    if (!isApplicantVideoFileAllowed(file)) {
      setError("Please upload an MP4, MOV, or WebM video.");
      return;
    }

    if (file.size > APPLICANT_VIDEO_MAX_SIZE_BYTES) {
      setError("Video is too large. Maximum size is 500MB.");
      return;
    }

    let durationInSeconds = 0;
    try {
      durationInSeconds = await getVideoDuration(file);
    } catch (durationError) {
      setError(getUploadErrorMessage(durationError));
      return;
    }

    if (durationInSeconds > APPLICANT_VIDEO_MAX_DURATION_SECONDS) {
      setError("Video is too long. Please keep it under 5 minutes.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    onUploadStateChange?.(true);

    try {
      const { mode } = await getUploadMode();
      const nextUpload =
        mode === "client"
          ? await uploadThroughBlob(file)
          : await uploadThroughServer(file);

      setUploadedVideo(nextUpload);
      onUploadComplete?.(nextUpload);
      setUploadProgress(100);
    } catch (uploadError) {
      setError(getUploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (file) {
      void handleFile(file);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  }

  const helperText = "MP4, MOV, or WebM. Aim for 2-5 minutes. Max 5 minutes / 500MB.";

  return (
    <div className="upload-area-wrapper">
      <input
        ref={inputRef}
        type="file"
        accept={APPLICANT_VIDEO_ACCEPT}
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <input type="hidden" name={name} value={uploadedVideo?.url ?? ""} />

      {uploadedVideo ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 16,
            background: "var(--surface)",
          }}
        >
          <video
            controls
            preload="metadata"
            src={uploadedVideo.url}
            style={{
              width: "100%",
              borderRadius: 12,
              background: "#000",
              maxHeight: 320,
            }}
          />
          <div className="upload-file-info" style={{ marginTop: 0 }}>
            <span className="upload-file-name">{uploadedVideo.originalName}</span>
            <span className="upload-file-size">{formatBytes(uploadedVideo.size)}</span>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Replace Video"}
            </button>
            <a
              href={uploadedVideo.url}
              target="_blank"
              rel="noreferrer"
              className="link"
              style={{ fontSize: 13 }}
            >
              Open video in a new tab
            </a>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{helperText}</p>
        </div>
      ) : (
        <div
          className={`upload-drop-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          style={{ minHeight: 180 }}
        >
          <div className="upload-icon" aria-hidden="true">🎥</div>
          <p className="upload-text">
            {uploading ? (
              <>
                <strong>Uploading your video...</strong>
              </>
            ) : (
              <>
                <strong>Click to upload</strong> or drag and drop
              </>
            )}
          </p>
          <p className="upload-hint">
            {uploading && uploadProgress != null
              ? `Upload progress: ${uploadProgress}%`
              : helperText}
          </p>
        </div>
      )}

      {uploading && uploadProgress != null && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          Uploading: {uploadProgress}%
        </p>
      )}

      {error && <div className="form-error">{error}</div>}

      {!uploadedVideo && !uploading && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
          Upload your required video here before you submit the application.
        </p>
      )}
    </div>
  );
}
