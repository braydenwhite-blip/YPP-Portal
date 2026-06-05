import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

/**
 * Links a person's name to their read-only public profile (`/people/[id]`).
 *
 * Falls back to plain inline text when there is no real user to link to — e.g.
 * the synthetic "system" author on audit entries, or an empty id — so callers
 * can wrap every name unconditionally without special-casing.
 *
 * Works in both server and client components (Next `Link` is isomorphic).
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
    >
      {children}
    </Link>
  );
}
