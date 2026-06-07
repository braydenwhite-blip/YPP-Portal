import type { SVGProps } from "react";

/**
 * Compact inline-SVG icon set for the People Strategy / Action Tracker surfaces.
 * Stroke-based, inherits `currentColor`, sized by CSS (the consuming chips set
 * width/height). Kept dependency-free so server components can render them.
 */

export type PsIconName =
  | "alert"
  | "activity"
  | "bolt"
  | "inbox"
  | "calendar"
  | "list"
  | "eye"
  | "flag"
  | "clock"
  | "check"
  | "users"
  | "layers"
  | "target";

const PATHS: Record<PsIconName, React.ReactNode> = {
  alert: (
    <>
      <path d="M10.3 3.3 2.5 16.5a1.4 1.4 0 0 0 1.2 2.1h12.6a1.4 1.4 0 0 0 1.2-2.1L9.7 3.3a1.4 1.4 0 0 0-2.4 0Z" />
      <path d="M10 8v4" />
      <path d="M10 15.2h.01" />
    </>
  ),
  activity: <path d="M2 11h3.2l2.3 6 3.6-12 2.3 6H17" />,
  bolt: <path d="M11.2 2 4 11.2h4.6L8 18l7.2-9.2H10.6L11.2 2Z" />,
  inbox: (
    <>
      <path d="M2.5 11.5 5 4.5h10l2.5 7v4.5a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1v-4.5Z" />
      <path d="M2.5 11.5H7l1 2h4l1-2h4.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="13" rx="2" />
      <path d="M3 8h14M7 2.5v4M13 2.5v4" />
    </>
  ),
  list: (
    <>
      <path d="M7 5.5h10M7 10h10M7 14.5h10" />
      <path d="M3.3 5.5h.01M3.3 10h.01M3.3 14.5h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M1.8 10S4.7 4.5 10 4.5 18.2 10 18.2 10 15.3 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </>
  ),
  flag: (
    <>
      <path d="M4.5 2.5v15" />
      <path d="M4.5 3.5h9.5l-1.6 3 1.6 3H4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.8V10l3 1.8" />
    </>
  ),
  check: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M6.5 10.2 9 12.6l4.3-4.8" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="7" r="2.6" />
      <path d="M2.8 16.2c0-2.6 2.1-4.4 4.7-4.4s4.7 1.8 4.7 4.4" />
      <path d="M13.5 5.2a2.5 2.5 0 0 1 0 4.9M14.4 11.9c2 .4 3.4 1.9 3.4 4.1" />
    </>
  ),
  layers: (
    <>
      <path d="M10 2.5 17.5 7 10 11.5 2.5 7 10 2.5Z" />
      <path d="M2.5 11 10 15.5 17.5 11" />
    </>
  ),
  target: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="10" cy="10" r="3.6" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" />
    </>
  ),
};

export function PsIcon({
  name,
  ...props
}: { name: PsIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
