export const APPLICANT_VIDEO_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const APPLICANT_VIDEO_ALLOWED_EXTENSIONS = [".mp4", ".mov", ".webm"] as const;

export const APPLICANT_VIDEO_ACCEPT = [
  ...APPLICANT_VIDEO_ALLOWED_MIME_TYPES,
  ...APPLICANT_VIDEO_ALLOWED_EXTENSIONS,
].join(",");

export const APPLICANT_VIDEO_MAX_SIZE_BYTES = 500 * 1024 * 1024;
export const APPLICANT_VIDEO_MAX_DURATION_SECONDS = 5 * 60;
export const APPLICANT_VIDEO_STORAGE_PREFIX = "instructor-application-videos";

const STORED_FILE_URL_PATTERN = /^(https?:\/\/|\/uploads\/)/i;

export function isApplicantVideoFileAllowed(file: Pick<File, "name" | "type">) {
  const normalizedName = file.name.toLowerCase();
  const hasAllowedMimeType = APPLICANT_VIDEO_ALLOWED_MIME_TYPES.includes(
    file.type as (typeof APPLICANT_VIDEO_ALLOWED_MIME_TYPES)[number]
  );
  const hasAllowedExtension = APPLICANT_VIDEO_ALLOWED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );

  return hasAllowedMimeType || hasAllowedExtension;
}

export function isStoredFileUrl(value: string) {
  return STORED_FILE_URL_PATTERN.test(value.trim());
}

export function sanitizeUploadFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
