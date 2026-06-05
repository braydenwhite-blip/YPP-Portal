"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { recordCommandCenterEvent } from "@/lib/people-strategy/command-center-telemetry";
import type { CommandCenterEventName } from "@/lib/people-strategy/command-center-events";

/**
 * A drop-in `next/link` that fires a Command Center adoption event on click
 * before navigating (Phase 6 #4). The telemetry write is fire-and-forget and
 * swallows its own errors, so navigation is never blocked or delayed by it.
 */
export function TelemetryLink({
  href,
  event,
  eventData,
  className,
  style,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  event: CommandCenterEventName;
  eventData?: Record<string, string | number | boolean | null>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={() => {
        void recordCommandCenterEvent(event, eventData);
      }}
    >
      {children}
    </Link>
  );
}
