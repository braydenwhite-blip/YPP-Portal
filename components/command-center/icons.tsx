import type { SVGProps } from "react";

/**
 * Command Center icon set — compact, stroke-based inline SVG (no dependency, no
 * external icon library, server-renderable). Each inherits `currentColor` and is
 * sized by the consumer.
 */

export type CcIconName =
  | "target"
  | "scale"
  | "calendar"
  | "users"
  | "user"
  | "clock"
  | "hourglass"
  | "check"
  | "flag"
  | "bolt"
  | "inbox"
  | "sparkle"
  | "arrowRight"
  | "activity"
  | "compass"
  | "send"
  | "handoff"
  | "list"
  | "sun"
  | "eye"
  | "layers";

const PATHS: Record<CcIconName, React.ReactNode> = {
  target: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2" />
    </>
  ),
  scale: (
    <>
      <path d="M10 3v14M5 6h10M5 6 3 11h4L5 6Zm10 0-2 5h4l-2-5Z" />
      <path d="M6.5 17h7" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5v4M13 2.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M2.8 16c0-2.6 2.1-4.3 4.7-4.3s4.7 1.7 4.7 4.3" />
      <path d="M13.4 5.2a2.6 2.6 0 0 1 0 5M14 11.8c2.2.2 3.9 1.8 3.9 4.2" />
    </>
  ),
  user: (
    <>
      <circle cx="10" cy="6.5" r="3" />
      <path d="M3.8 17c0-3 2.8-5 6.2-5s6.2 2 6.2 5" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 6v4.2l2.8 1.8" />
    </>
  ),
  hourglass: (
    <>
      <path d="M5.5 3h9M5.5 17h9" />
      <path d="M6 3c0 3.5 4 4.5 4 7 0-2.5 4-3.5 4-7M6 17c0-3.5 4-4.5 4-7 0 2.5 4 3.5 4 7" />
    </>
  ),
  check: <path d="M4.5 10.5 8.5 14.5 15.5 6" />,
  flag: (
    <>
      <path d="M5 3v14" />
      <path d="M5 4h9l-1.6 3L14 10H5" />
    </>
  ),
  bolt: <path d="M11.2 2 4 11.2h4.6L8 18l7.2-9.2H10.6L11.2 2Z" />,
  inbox: (
    <>
      <path d="M2.5 11.5 5 4.5h10l2.5 7v4.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-4.5Z" />
      <path d="M2.5 11.5H7l1 2h4l1-2h4.5" />
    </>
  ),
  sparkle: (
    <path d="M10 2.5c.4 3.4 1.6 4.6 5 5-3.4.4-4.6 1.6-5 5-.4-3.4-1.6-4.6-5-5 3.4-.4 4.6-1.6 5-5ZM15.8 11.5c.2 1.4.7 1.9 2.1 2.1-1.4.2-1.9.7-2.1 2.1-.2-1.4-.7-1.9-2.1-2.1 1.4-.2 1.9-.7 2.1-2.1Z" />
  ),
  arrowRight: <path d="M4 10h12M11 5l5 5-5 5" />,
  activity: <path d="M2 11h3.2l2.3 6 3.6-12 2.3 6H17" />,
  compass: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M13.2 6.8 11 11l-4.2 2.2L9 9l4.2-2.2Z" />
    </>
  ),
  send: <path d="M17 3 9 11M17 3l-5 14-3-6-6-3 14-5Z" />,
  handoff: (
    <>
      <path d="M3 8h7l-2-2M17 12h-7l2 2" />
      <circle cx="4.5" cy="14" r="1.8" />
      <circle cx="15.5" cy="6" r="1.8" />
    </>
  ),
  list: (
    <>
      <path d="M7 5.5h10M7 10h10M7 14.5h10" />
      <path d="M3.3 5.5h.01M3.3 10h.01M3.3 14.5h.01" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 10S4.7 4.5 10 4.5 18.2 10 18.2 10 15.3 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  layers: (
    <>
      <path d="M10 2.5 17.5 6.5 10 10.5 2.5 6.5 10 2.5Z" />
      <path d="M2.5 10 10 14 17.5 10M2.5 13.5 10 17.5 17.5 13.5" />
    </>
  ),
};

export function CcIcon({
  name,
  size = 18,
  className,
  ...rest
}: { name: CcIconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
