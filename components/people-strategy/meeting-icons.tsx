import type { CSSProperties } from "react";

/**
 * Minimal stroke icon set for the Meetings Tracker / Weekly Command Center —
 * clean, geometric, single-stroke, `currentColor` for theming. Ported verbatim
 * from the approved design so the command center's iconography matches the mock
 * exactly. Category icon keys line up with `meeting-categories.ts`.
 */

const PATHS: Record<string, string> = {
  // category identities
  compass: "M12 3a9 9 0 100 18 9 9 0 000-18zm3.5 5.5l-2 4.5-4.5 2 2-4.5 4.5-2z",
  book: "M5 4h11a2 2 0 012 2v13H7a2 2 0 00-2 2V4zm2 0v13M7 19h11",
  presenter: "M4 4h16M12 4v3m0 0l-5 6h10l-5-6zM8 20l4-5 4 5",
  inbox: "M4 13l2.5-7h11L20 13v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5zm0 0h4l1.5 3h5L16 13h4",
  people: "M9 11a3 3 0 100-6 3 3 0 000 6zm7 0a3 3 0 100-6M3 19a6 6 0 0112 0m1.5-4.5A6 6 0 0121 19",
  map: "M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2zm0 0v14m6-12v14",
  handshake:
    "M8 12l2.5-2.5a2 2 0 012.8 0L18 14m-7-5l3 3M4 9l4-4h3l3 3 3-3h2l3 4m-9 8l2 2a1.5 1.5 0 002-2l3 3",
  megaphone: "M4 10v4l9 4V6l-9 4zm0 0H3a1 1 0 00-1 1v2a1 1 0 001 1h1m9-7l6-3v15l-6-3M7 18v3",
  code: "M9 8l-5 4 5 4m6-8l5 4-5 4",
  gear:
    "M12 9a3 3 0 100 6 3 3 0 000-6zm0-5l1.5 2.5 3-.5.5 3 2.5 1.5-1.5 2.5 1.5 2.5-2.5 1.5-.5 3-3-.5L12 20l-1.5-2.5-3 .5-.5-3L4.5 13.5 6 11 4.5 8.5l2.5-1.5.5-3 3 .5L12 4z",
  coin: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v10m-2.5-7.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4",
  dot: "M12 9a3 3 0 100 6 3 3 0 000-6z",
  // chrome / ui
  grid: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  calendar: "M4 6a2 2 0 012-2h12a2 2 0 012 2v13H4V6zm0 4h16M8 3v4m8-4v4",
  plus: "M12 5v14M5 12h14",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  check: "M5 12l5 5L20 7",
  checkCircle: "M12 3a9 9 0 100 18 9 9 0 000-18zm-3.5 9l2.5 2.5L15 9",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4v5l3.5 2",
  alert: "M12 4l9 16H3L12 4zm0 6v4m0 3h.01",
  arrowR: "M5 12h14m-6-6l6 6-6 6",
  arrowUpR: "M7 17L17 7m0 0H8m9 0v9",
  flag: "M6 3v18M6 4h10l-2 3 2 3H6",
  spark: "M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z",
  bolt: "M13 3L5 13h5l-1 8 8-10h-5l1-8z",
  search: "M11 4a7 7 0 105 12l4 4M11 4a7 7 0 014.95 11.95",
  filter: "M4 5h16l-6 7v6l-4 2v-8L4 5z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zm10-13l4 4",
  target: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10zm0 4a1 1 0 100 2 1 1 0 000-2z",
  x: "M6 6l12 12M18 6L6 18",
  doc: "M6 3h8l4 4v14H6V3zm8 0v4h4M9 12h6M9 16h6",
  link: "M9 15l6-6m-4-3l1-1a4 4 0 016 6l-1 1m-9 3l-1 1a4 4 0 01-6-6l1-1",
  user: "M12 11a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0",
  repeat: "M4 9l3-3m-3 3l3 3M4 9h11a4 4 0 014 4M20 15l-3 3m3-3l-3-3m3 3H9a4 4 0 01-4-4",
};

export type MeetingIconName = keyof typeof PATHS | string;

export function MeetingIcon({
  name,
  size = 18,
  stroke = 2,
  style,
  className,
}: {
  name: MeetingIconName;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const d = PATHS[name] ?? PATHS.dot;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={{ flex: "0 0 auto", ...style }}
    >
      <path d={d} />
    </svg>
  );
}
