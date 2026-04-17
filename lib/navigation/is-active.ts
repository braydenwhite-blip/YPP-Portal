export function isNavHrefActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function profileMergedIntoPersonalizationActive(
  pathname: string,
  candidateHrefs: readonly string[],
): boolean {
  if (candidateHrefs.includes("/profile")) return false;
  if (pathname === "/profile") return true;
  return pathname.startsWith("/profile/") && !pathname.startsWith("/profile/timeline");
}

function navHrefMatchesPathnameForActive(
  pathname: string,
  href: string,
  candidateHrefs: readonly string[],
): boolean {
  if (isNavHrefActive(href, pathname)) return true;
  if (
    href === "/settings/personalization" &&
    profileMergedIntoPersonalizationActive(pathname, candidateHrefs)
  ) {
    return true;
  }
  return false;
}

export function resolveNavActiveHref(
  pathname: string,
  candidateHrefs: readonly string[],
): string | null {
  const uniqueHrefs = Array.from(
    new Set(
      candidateHrefs.filter(
        (href): href is string => typeof href === "string" && href.length > 0 && href !== "#"
      )
    )
  );
  const matches = uniqueHrefs.filter((href) =>
    navHrefMatchesPathnameForActive(pathname, href, candidateHrefs)
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((best, href) => (href.length > best.length ? href : best));
}
