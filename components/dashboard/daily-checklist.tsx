import Link from "next/link";

export type ChecklistItem = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  priority: "today" | "soon" | "anytime";
  category: "task" | "suggestion";
  icon?: string;
};

interface DailyChecklistProps {
  items: ChecklistItem[];
}

export default function DailyChecklist({ items }: DailyChecklistProps) {
  if (items.length === 0) return null;

  const todayItems = items.filter((i) => i.priority === "today");
  const otherItems = items.filter((i) => i.priority !== "today");
  const displayItems = [...todayItems, ...otherItems].slice(0, 5);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, fontSize: 16 }}>
        What to do today
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {displayItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--border, #e2e8f0)",
              textDecoration: "none",
              color: "inherit",
              transition: "background 0.15s",
              background:
                item.category === "suggestion"
                  ? "var(--gray-50, #f7fafc)"
                  : "white",
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>
              {item.icon ?? (item.category === "task" ? "📋" : "💡")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.title}
              </div>
              {item.detail && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted, #666)",
                    marginTop: 2,
                  }}
                >
                  {item.detail}
                </div>
              )}
            </div>
            {item.priority === "today" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ypp-purple, #6b21c8)",
                  background: "var(--ypp-purple-light, #f0e6ff)",
                  padding: "2px 8px",
                  borderRadius: 12,
                  flexShrink: 0,
                }}
              >
                Today
              </span>
            )}
            <span
              style={{
                color: "var(--gray-400, #a0aec0)",
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
