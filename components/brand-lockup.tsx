"use client";

import type { MouseEventHandler } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/components/ui-v2";

/** Intrinsic asset size (ypp-logo-mark.png, cropped to artwork bounds) */
const MARK_W = 806;
const MARK_H = 556;

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
   * Surface tone. `dark` renders white type on the premium sidebar; the mark
   * uses the transparent logo asset directly (no white tile).
   * Default `light` keeps the legacy classes for every other surface.
   */
  tone?: "light" | "dark";
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
  tone = "light",
  reloadOnClick = false,
  href,
  onClick,
}: BrandLockupProps) {
  const dark = tone === "dark";
  const h = height;
  const w = Math.round((MARK_W / MARK_H) * h);
  const rootClass = [
    "portal-brand",
    reloadOnClick ? "portal-brand--reload" : href ? "portal-brand--link" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const mark = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        dark && "h-10 w-[58px]",
      )}
    >
      <Image
        src="/ypp-logo-mark.png?v=2308109d"
        alt=""
        width={w}
        height={h}
        className={cn(
          "portal-brand-mark shrink-0 object-contain",
          dark &&
            "h-10 w-auto max-w-full object-left [filter:drop-shadow(0_1px_6px_rgba(167,118,255,0.28))_drop-shadow(0_0_14px_rgba(124,72,220,0.16))]",
        )}
        priority={priority}
        quality={95}
        sizes={dark ? "64px" : "160px"}
        unoptimized
      />
    </span>
  );

  const inner = (
    <>
      {mark}
      <div className="portal-brand-text min-w-0">
        <span className={dark ? "portal-brand-title text-white" : "portal-brand-title"}>
          Youth Passion Project
        </span>
        {showTagline ? (
          <span
            className={
              dark ? "portal-brand-tagline text-white/55" : "portal-brand-tagline"
            }
          >
            Guiding the stars of tomorrow.
          </span>
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
