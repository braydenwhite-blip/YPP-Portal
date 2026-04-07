"use client";

import type { MouseEventHandler } from "react";
import Image from "next/image";
import Link from "next/link";

/** Intrinsic asset size (ypp-logo-mark.png) */
const MARK_W = 128;
const MARK_H = 84;

/** Main sign-in entry (full load resets auth UI state). */
export const PORTAL_LOGIN_HREF = "/login" as const;

type BrandLockupProps = {
  /** Height of the mark in CSS pixels; width scales with aspect ratio. */
  height?: number;
  className?: string;
  priority?: boolean;
  /** Match marketing header: hide tagline in very tight layouts. */
  showTagline?: boolean;
  /**
   * Public auth only: full navigation to `/login` so users can restart sign-in.
   * (Not used in the logged-in app shell.)
   */
  reloadOnClick?: boolean;
  /**
   * In-app: whole lockup (mark + title + tagline) links here via client navigation.
   * Ignored when `reloadOnClick` is true.
   */
  href?: string;
  /** Optional handler when `href` is used (e.g. close mobile nav). */
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

/**
 * Brand row matching youth-passion-project Header: logo mark + Lora title + Nunito tagline.
 * @see https://github.com/YPPTech/youth-passion-project
 */
export default function BrandLockup({
  height = 48,
  className,
  priority,
  showTagline = true,
  reloadOnClick = false,
  href,
  onClick,
}: BrandLockupProps) {
  const h = height;
  const w = Math.round((MARK_W / MARK_H) * h);
  const rootClass = [
    "portal-brand",
    reloadOnClick ? "portal-brand--reload" : href ? "portal-brand--link" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <Image
        src="/ypp-logo-mark.png"
        alt=""
        width={w}
        height={h}
        className="portal-brand-mark"
        priority={priority}
      />
      <div className="portal-brand-text min-w-0">
        <span className="portal-brand-title">Youth Passion Project</span>
        {showTagline ? (
          <span className="portal-brand-tagline">Guiding the stars of tomorrow.</span>
        ) : null}
      </div>
    </>
  );

  if (reloadOnClick) {
    return (
      <a
        href={PORTAL_LOGIN_HREF}
        className={rootClass}
        aria-label="Youth Passion Project — go to sign in"
        onClick={(e) => {
          e.preventDefault();
          // Hard navigation so the main login screen always loads fresh (SPA routing can skip this).
          window.location.replace(
            `${window.location.origin}${PORTAL_LOGIN_HREF}`,
          );
        }}
      >
        {inner}
      </a>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className={rootClass}
        aria-label="Youth Passion Project — home"
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }

  return <div className={rootClass}>{inner}</div>;
}
