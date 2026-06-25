"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import type { Entity360Type } from "@/lib/operations/entity-360";

import { useEntity360 } from "./entity-360-context";

/** Where each entity type's full page lives — the navigation fallback. */
const DEFAULT_HREF: Record<Entity360Type, (id: string) => string> = {
  person: (id) => `/people/${id}`,
  class: (id) => `/admin/classes/${id}`,
  partner: (id) => `/admin/partners/${id}`,
  initiative: (id) => `/operations/initiatives/${id}`,
  meeting: (id) => `/meetings/${id}`,
  action: (id) => `/actions/${id}`,
  mentorship: (id) => `/admin/mentorship/relationships/${id}`,
  applicant: (id) => `/admin/instructor-applicants/${id}`,
  chapter: (id) => `/admin/chapters/${id}`,
};

/**
 * Links any entity name to its 360 panel — the universal sibling of
 * `PersonLink`. A plain left-click opens the slide-in Entity 360 drawer in
 * place (when the app-shell provider is mounted); modifier/middle clicks and
 * provider-less usage fall back to normal navigation, so deep links and
 * "open in new tab" keep working. Renders plain text when there is no id.
 */
export function EntityLink({
  type,
  id,
  href,
  children,
  className,
  style,
  title,
}: {
  type: Entity360Type;
  id: string | null | undefined;
  /** Override the navigation fallback (defaults to the entity's full page). */
  href?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const drawer = useEntity360();
  if (!id) {
    // No drawer target — keep an href-only link working, else plain text.
    if (href) {
      return (
        <Link href={href} className={className} title={title} style={{ textDecoration: "none", ...style }}>
          {children}
        </Link>
      );
    }
    return (
      <span className={className} style={style}>
        {children}
      </span>
    );
  }
  const target = href ?? DEFAULT_HREF[type](id);
  return (
    <Link
      href={target}
      className={className}
      title={title}
      style={{ textDecoration: "none", ...style }}
      onClick={(e) => {
        if (
          drawer &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          drawer.openEntity(type, id);
        }
      }}
    >
      {children}
    </Link>
  );
}
