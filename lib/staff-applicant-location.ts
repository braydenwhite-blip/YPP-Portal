/**
 * Free-text staff applicant location (not a Chapter FK).
 * Stored on Application.additionalMaterials as JSON `location` so SMM metadata
 * and other structured payloads keep working.
 */

export function extractStaffLocation(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const location = (parsed as { location?: unknown }).location;
      if (typeof location === "string" && location.trim()) return location.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function mergeStaffLocationIntoMaterials(
  raw: string | null | undefined,
  location: string | null | undefined
): string | null {
  const trimmed = location?.trim() || null;
  let base: Record<string, unknown> = {};

  if (raw?.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        base = { ...(parsed as Record<string, unknown>) };
      } else {
        base = { kind: "STAFF_LOCATION_V1", priorMaterials: raw };
      }
    } catch {
      base = { kind: "STAFF_LOCATION_V1", priorMaterials: raw };
    }
  } else if (trimmed) {
    base = { kind: "STAFF_LOCATION_V1" };
  } else {
    return null;
  }

  if (trimmed) base.location = trimmed;
  else delete base.location;

  if (
    base.kind === "STAFF_LOCATION_V1" &&
    !trimmed &&
    !base.priorMaterials &&
    Object.keys(base).length <= 1
  ) {
    return null;
  }

  return JSON.stringify(base);
}

/** Normalize typed location against known chapter names for optional FK sync. */
export function matchOperatingChapterName(
  location: string | null | undefined
): "The Bronx" | "Scarsdale" | null {
  const normalized = (location ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (
    normalized === "the bronx" ||
    normalized === "bronx" ||
    normalized === "bx"
  ) {
    return "The Bronx";
  }
  if (normalized === "scarsdale") return "Scarsdale";
  return null;
}
