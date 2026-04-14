import Link from "next/link";
import type { ReviewSpineCycle, ReviewSpineStep } from "@/lib/mentorship-cycle";

type Props = {
  cycles: ReviewSpineCycle[];
  title?: string;
};

const STATE_COLORS: Record<ReviewSpineStep["state"], { bg: string; ring: string; label: string }> = {
  completed: { bg: "#166534", ring: "#dcfce7", label: "Completed" },
  active: { bg: "#2563eb", ring: "#dbeafe", label: "In progress" },
  pending: { bg: "#cbd5e1", ring: "#f1f5f9", label: "Pending" },
  skipped: { bg: "#a1a1aa", ring: "#f4f4f5", label: "Skipped" },
};

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StepRow({ step, isLast }: { step: ReviewSpineStep; isLast: boolean }) {
  const color = STATE_COLORS[step.state];
  return (
    <div style={{ display: "flex", gap: 12, position: "relative", paddingBottom: isLast ? 0 : 16 }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: color.bg,
            border: `3px solid ${color.ring}`,
            flexShrink: 0,
            marginTop: 4,
          }}
          aria-label={color.label}
        />
        {!isLast && (
          <div
            style={{
              width: 2,
              flex: 1,
              background: "#e2e8f0",
              marginTop: 2,
              minHeight: 18,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "0.9rem" }}>{step.label}</strong>
          {step.timestamp && (
            <span className="muted" style={{ fontSize: "0.75rem" }}>
              {formatShortDate(step.timestamp)}
            </span>
          )}
          {step.state === "active" && (
            <span
              className="pill"
              style={{ fontSize: "0.65rem", background: "#dbeafe", color: "#1e40af" }}
            >
              In progress
            </span>
          )}
        </div>
        {step.detail && (
          <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.8rem" }}>
            {step.detail}
          </p>
        )}
        {step.href && (
          <Link
            href={step.href}
            style={{ fontSize: "0.8rem", display: "inline-block", marginTop: 2 }}
          >
            View →
          </Link>
        )}
      </div>
    </div>
  );
}

function CycleBlock({ cycle, initiallyOpen }: { cycle: ReviewSpineCycle; initiallyOpen: boolean }) {
  return (
    <details
      open={initiallyOpen}
      className="card"
      style={{ padding: "0.9rem 1rem", marginBottom: 10 }}
    >
      <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "0.95rem" }}>
          Cycle {cycle.cycleNumber} · {cycle.cycleLabel}
        </strong>
        {initiallyOpen && (
          <span className="pill" style={{ fontSize: "0.7rem" }}>
            Current
          </span>
        )}
      </summary>
      <div style={{ marginTop: 12 }}>
        {cycle.steps.map((step, idx) => (
          <StepRow key={step.key} step={step} isLast={idx === cycle.steps.length - 1} />
        ))}
      </div>
    </details>
  );
}

export function ReviewSpine({ cycles, title = "Review history" }: Props) {
  if (cycles.length === 0) {
    return (
      <section className="card" style={{ padding: "1rem 1.1rem" }}>
        <strong style={{ fontSize: "0.95rem" }}>{title}</strong>
        <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>
          No cycles yet — your timeline will appear here once your first reflection is open.
        </p>
      </section>
    );
  }

  const [current, ...past] = cycles;

  return (
    <section style={{ marginTop: 16, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>{title}</h3>
      <CycleBlock cycle={current} initiallyOpen />
      {past.length > 0 && (
        <details className="card" style={{ padding: "0.75rem 1rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Previous cycles ({past.length})
          </summary>
          <div style={{ marginTop: 12 }}>
            {past.map((c) => (
              <CycleBlock key={c.cycleNumber} cycle={c} initiallyOpen={false} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
