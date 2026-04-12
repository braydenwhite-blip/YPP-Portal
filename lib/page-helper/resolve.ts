import { PAGE_HELP_ENTRIES } from "@/lib/page-helper/registry";
import { compareRoutePatterns, matchRoutePattern } from "@/lib/page-helper/route-utils";
import type {
  PageHelperContent,
  PageHelperEntry,
  PageHelperRole,
  ResolvePageHelperInput,
  ResolvedPageHelper,
} from "@/lib/page-helper/types";

const SORTED_PAGE_HELP_ENTRIES = [...PAGE_HELP_ENTRIES].sort((left, right) =>
  compareRoutePatterns(left.pattern, right.pattern)
);

function resolveRoleContent(
  entry: PageHelperEntry,
  primaryRole?: PageHelperRole | null,
  roles?: string[] | null
): PageHelperContent {
  if (!entry.roleOverrides) {
    return entry.content;
  }

  if (primaryRole && entry.roleOverrides[primaryRole]) {
    return entry.roleOverrides[primaryRole] as PageHelperContent;
  }

  for (const role of roles ?? []) {
    if (entry.roleOverrides[role as PageHelperRole]) {
      return entry.roleOverrides[role as PageHelperRole] as PageHelperContent;
    }
  }

  if (roles && roles.length > 0 && entry.roleOverrides.AUTHENTICATED) {
    return entry.roleOverrides.AUTHENTICATED;
  }

  if ((!roles || roles.length === 0) && entry.roleOverrides.PUBLIC) {
    return entry.roleOverrides.PUBLIC;
  }

  return entry.content;
}

export function resolvePageHelper(input: ResolvePageHelperInput): ResolvedPageHelper | null {
  const matchedEntry = SORTED_PAGE_HELP_ENTRIES.find((entry) =>
    matchRoutePattern(entry.pattern, input.pathname)
  );

  if (!matchedEntry) {
    return null;
  }

  return {
    pattern: matchedEntry.pattern,
    title: matchedEntry.title,
    content: resolveRoleContent(matchedEntry, input.primaryRole, input.roles),
    hidden: matchedEntry.hidden === true,
    placement: matchedEntry.placement ?? "bottom-right",
  };
}
