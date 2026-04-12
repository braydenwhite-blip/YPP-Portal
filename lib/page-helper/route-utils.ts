const ROUTE_GROUP_SEGMENT = /^\(.*\)$/;

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";

  const trimmed = pathname.trim();
  if (trimmed === "/") return "/";

  const withoutQuery = trimmed.split("?")[0]?.split("#")[0] ?? "/";
  const normalized = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

export function appPageFileToRoutePattern(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const relative = normalized.replace(/^app\//, "");
  const withoutFile = relative.replace(/\/page\.tsx$/, "");
  const segments = withoutFile
    .split("/")
    .filter(Boolean)
    .filter((segment) => !ROUTE_GROUP_SEGMENT.test(segment));

  if (segments.length === 0) return "/";
  return `/${segments.join("/")}`;
}

export function matchRoutePattern(pattern: string, pathname: string): boolean {
  const patternSegments = normalizePathname(pattern).split("/").filter(Boolean);
  const pathnameSegments = normalizePathname(pathname).split("/").filter(Boolean);

  let patternIndex = 0;
  let pathnameIndex = 0;

  while (patternIndex < patternSegments.length && pathnameIndex < pathnameSegments.length) {
    const patternSegment = patternSegments[patternIndex];
    const pathnameSegment = pathnameSegments[pathnameIndex];

    if (!patternSegment) {
      patternIndex += 1;
      continue;
    }

    if (/^\[\[\.\.\..+\]\]$/.test(patternSegment)) {
      return true;
    }

    if (/^\[\.\.\..+\]$/.test(patternSegment)) {
      return pathnameIndex < pathnameSegments.length;
    }

    if (/^\[.+\]$/.test(patternSegment)) {
      patternIndex += 1;
      pathnameIndex += 1;
      continue;
    }

    if (patternSegment !== pathnameSegment) {
      return false;
    }

    patternIndex += 1;
    pathnameIndex += 1;
  }

  if (patternIndex === patternSegments.length && pathnameIndex === pathnameSegments.length) {
    return true;
  }

  const remainingPattern = patternSegments.slice(patternIndex);
  return remainingPattern.length === 1 && /^\[\[\.\.\..+\]\]$/.test(remainingPattern[0]);
}

export function compareRoutePatterns(left: string, right: string): number {
  const leftSegments = left.split("/").filter(Boolean);
  const rightSegments = right.split("/").filter(Boolean);

  const leftStatic = leftSegments.filter((segment) => !segment.startsWith("[")).length;
  const rightStatic = rightSegments.filter((segment) => !segment.startsWith("[")).length;

  if (leftStatic !== rightStatic) {
    return rightStatic - leftStatic;
  }

  if (leftSegments.length !== rightSegments.length) {
    return rightSegments.length - leftSegments.length;
  }

  return left.localeCompare(right);
}
