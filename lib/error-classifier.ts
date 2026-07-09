export type ErrorKind =
  | "database"
  | "network"
  | "auth"
  | "not_found"
  | "timeout"
  | "validation"
  | "unknown";

export interface ErrorMeta {
  kind: ErrorKind;
  label: string;
  icon: string;
  heading: string;
  description: string;
  /** Tailwind color key used by the error screens */
  color: "red" | "blue" | "orange" | "amber" | "yellow" | "gray";
  /** Whether retrying the same action is likely to help */
  retryable: boolean;
}

export function classifyError(
  error: Error & { digest?: string; code?: string }
): ErrorMeta {
  const msg = (error.message ?? "").toLowerCase();
  const name = (error.name ?? "").toLowerCase();

  // Prisma / database errors — catch by class name, Prisma error codes (P1xxx–P3xxx), or keywords
  if (
    name.includes("prisma") ||
    name.includes("database") ||
    msg.includes("prisma") ||
    /\bp[123]\d{3}\b/.test(error.message ?? "") ||
    msg.includes("database") ||
    msg.includes("sql")
  ) {
    return {
      kind: "database",
      label: "Database Error",
      icon: "🗄️",
      heading: "Database Error",
      description:
        "A database operation failed. This usually means a schema mismatch, constraint violation, or connection problem.",
      color: "red",
      retryable: false,
    };
  }

  // Not found
  if (
    msg.includes("next_not_found") ||
    msg.includes("not found") ||
    name.includes("notfounderror")
  ) {
    return {
      kind: "not_found",
      label: "Not Found",
      icon: "🔍",
      heading: "Resource Not Found",
      description:
        "The page or resource you're looking for doesn't exist or has been moved.",
      color: "blue",
      retryable: false,
    };
  }

  // Auth / permission
  if (
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("unauthenticated") ||
    msg.includes("access denied") ||
    msg.includes("permission") ||
    name.includes("autherror") ||
    name.includes("unauthorizederror")
  ) {
    return {
      kind: "auth",
      label: "Access Denied",
      icon: "🔒",
      heading: "Access Denied",
      description:
        "You don't have permission to view this page or perform this action.",
      color: "orange",
      retryable: false,
    };
  }

  // Timeout
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("deadline exceeded")
  ) {
    return {
      kind: "timeout",
      label: "Timeout",
      icon: "⏱️",
      heading: "Request Timed Out",
      description:
        "The server took too long to respond. This is usually temporary — try again in a moment.",
      color: "amber",
      retryable: true,
    };
  }

  // Network / fetch failures
  if (
    name.includes("networkerror") ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("network error")
  ) {
    return {
      kind: "network",
      label: "Network Error",
      icon: "📡",
      heading: "Network Error",
      description:
        "A network request failed. Check your connection or try again in a moment.",
      color: "yellow",
      retryable: true,
    };
  }

  // Validation / parse errors
  if (
    name.includes("zoderror") ||
    msg.includes("validation") ||
    msg.includes("invalid input") ||
    msg.includes("parse error")
  ) {
    return {
      kind: "validation",
      label: "Validation Error",
      icon: "⚠️",
      heading: "Invalid Data",
      description:
        "The request contained invalid or unexpected data.",
      color: "yellow",
      retryable: false,
    };
  }

  return {
    kind: "unknown",
    label: "Unexpected Error",
    icon: "❌",
    heading: "Something Went Wrong",
    description:
      "An unexpected error occurred. Our team has been notified.",
    color: "gray",
    retryable: true,
  };
}
