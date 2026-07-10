export function reportClientError(
  boundary: string,
  error: Error & { digest?: string },
  extra: Record<string, unknown> = {}
) {
  const message =
    error.message ||
    (typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "") ||
    (error.digest ? `Server error (digest ${error.digest})` : "Unknown error");

  const stack =
    error.stack ||
    (typeof error === "object" && error !== null && "stack" in error
      ? String((error as { stack?: unknown }).stack ?? "")
      : undefined);

  console.error(`[${boundary}]`, {
    message,
    digest: error.digest,
    stack,
    ...extra,
  });
}
