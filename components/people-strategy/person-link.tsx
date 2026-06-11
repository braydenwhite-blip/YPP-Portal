"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { useProfileDrawer } from "@/components/people-strategy/profile-drawer-context";

/**
 * Links a person's name to their public profile.
 *
 * When the Entity 360 provider is mounted above it (the app shell), a plain
 * left-click opens the person's 360 panel in a slide-in drawer instead of
 * navigating — keeping the user in context. Modifier/middle clicks, and any
 * usage outside a provider, fall back to a normal `/people/[id]` navigation,
 * so deep links and "open in new tab" keep working.
 *
 * Falls back to plain inline text when there is no real user to link to — e.g.
 * the synthetic "system" author on audit entries, or an empty id — so callers
 * can wrap every name unconditionally without special-casing.
 */
export function PersonLink({
  id,
  children,
  className,
  style,
}: {
  id: string | null | undefined;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const drawer = useProfileDrawer();
  const linkable = Boolean(id) && id !== "system";

  if (!linkable) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/people/${id}`}
      className={className}
      style={{ textDecoration: "none", ...style }}
      onClick={(e) => {
        // Plain left-click with a drawer available → open in place. Let
        // cmd/ctrl/shift/alt and middle-clicks fall through to navigation.
        if (
          drawer &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          drawer.openProfile(id as string);
        }
      }}
    >
      {children}
    </Link>
  );
}
