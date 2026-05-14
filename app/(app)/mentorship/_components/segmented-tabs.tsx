import Link from "next/link";

export interface SegmentedTab {
  id: string;
  label: string;
  href: string;
  count?: number;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  activeId: string;
  /** Accessible label for the group (e.g., "Mentorship view"). */
  ariaLabel?: string;
}

/**
 * A two-or-three-segment pill control rendered as anchor links.
 *
 * Using <Link> (not <button>) preserves middle-click and back-button
 * behavior — the active segment is a real URL, not client state. The
 * shell can be Server-rendered with no client JS.
 */
export function SegmentedTabs({
  tabs,
  activeId,
  ariaLabel = "View",
}: SegmentedTabsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 4,
        gap: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              textDecoration: "none",
              color: isActive ? "var(--ypp-purple-800)" : "var(--muted)",
              background: isActive ? "var(--ypp-purple-50)" : "transparent",
              transition:
                "background var(--transition-fast, 150ms ease), color var(--transition-fast, 150ms ease)",
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                aria-hidden
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isActive ? "var(--ypp-purple-700)" : "var(--muted)",
                  background: isActive
                    ? "var(--surface)"
                    : "var(--ypp-purple-50)",
                  padding: "1px 7px",
                  borderRadius: 999,
                  lineHeight: 1.4,
                }}
              >
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
