/**
 * Inline SVG icon set for the Final Review Cockpit.
 *
 * The plan recommends `lucide-react`; we keep the icon set inline here to
 * avoid pulling a runtime dependency for a self-contained surface. Each icon
 * follows lucide's conventions (24×24 viewBox, stroke-based) so a future swap
 * to `lucide-react` is mechanical.
 */

import type { SVGProps } from "react";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 16, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const XIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

export const PauseIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </Svg>
);

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Svg>
);

export const HelpCircleIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

export const RotateCwIcon = (props: IconProps) => (
  <Svg {...props}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </Svg>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Svg>
);

export const AlertOctagonIcon = (props: IconProps) => (
  <Svg {...props}>
    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </Svg>
);

export const ArrowUpRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </Svg>
);

export const ArrowRightIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </Svg>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </Svg>
);

export const ArrowDownLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="17" y1="7" x2="7" y2="17" />
    <polyline points="17 17 7 17 7 7" />
  </Svg>
);

export const MinusIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

export const ChevronDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const PinIcon = (props: IconProps) => (
  <Svg {...props}>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14V13a4 4 0 0 0-2.39-3.66L15 8.5V3h-6v5.5l-1.6 0.84A4 4 0 0 0 5 13z" />
  </Svg>
);

export const ThumbsUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z" />
    <line x1="7" y1="22" x2="7" y2="11" />
  </Svg>
);

export const FileQuestionIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 14a2 2 0 1 1 4 0c0 1-1 1.5-1 1.5" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </Svg>
);

export const RefreshIcon = (props: IconProps) => (
  <Svg {...props}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </Svg>
);

export const SparkleIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3v4" />
    <path d="M12 17v4" />
    <path d="M5.05 5.05l2.83 2.83" />
    <path d="M16.12 16.12l2.83 2.83" />
    <path d="M3 12h4" />
    <path d="M17 12h4" />
    <path d="M5.05 18.95l2.83-2.83" />
    <path d="M16.12 7.88l2.83-2.83" />
  </Svg>
);
