"use client";

interface ActiveLoadBadgeProps {
  activeCount: number;
  lastAssignedAt?: Date | string | null;
  label?: string;
}

function tone(count: number): { bg: string; color: string } {
  if (count <= 2) return { bg: "#f3e8ff", color: "#6b21c8" };
  if (count <= 5) return { bg: "#fef3c7", color: "#d97706" };
  return { bg: "#fee2e2", color: "#dc2626" };
}

export default function ActiveLoadBadge({
  activeCount,
  lastAssignedAt,
  label = "active",
}: ActiveLoadBadgeProps) {
  const { bg, color } = tone(activeCount);
  const title = lastAssignedAt
    ? `${activeCount} ${label} · Last assigned ${new Date(lastAssignedAt).toLocaleDateString()}`
    : `${activeCount} ${label}`;

  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: bg,
        color,
        borderRadius: 10,
        padding: "2px 7px",
        fontSize: 11,
        fontWeight: 600,
        cursor: "default",
      }}
    >
      {activeCount} {label}
    </span>
  );
}
