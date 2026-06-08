import Link from "next/link";
import { Meter } from "@/components/people-strategy/people-suite";
import type { PublishReadiness, PublishReadinessItem } from "@/lib/class-publish-readiness";

/**
 * Presentational "Missing before publish" checklist. Pure (server-renderable).
 * Consumes the result of `computePublishReadiness` so the instructor settings
 * page and the admin class detail page show the exact same, single-source
 * picture of what a class still needs before it can go live.
 */

function Row({ item }: { item: PublishReadinessItem }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "start", padding: "5px 0" }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          borderRadius: "50%",
          fontSize: 12,
          lineHeight: "18px",
          textAlign: "center",
          background: item.done ? "#dcfce7" : "var(--gray-100, #f3f4f6)",
          color: item.done ? "#16a34a" : "var(--gray-400, #9ca3af)",
        }}
      >
        {item.done ? "✓" : "○"}
      </span>
      <span style={{ fontSize: 13, color: item.done ? "var(--text-secondary)" : "inherit" }}>
        <span style={{ textDecoration: item.done ? "line-through" : "none" }}>{item.label}</span>
        {!item.done && item.detail ? (
          <span style={{ display: "block", fontSize: 12, color: "var(--text-secondary)", marginTop: 1 }}>
            {item.detail}
          </span>
        ) : null}
        {!item.done && item.href ? (
          <Link href={item.href} style={{ fontSize: 12, color: "var(--ypp-purple)", display: "inline-block", marginTop: 1 }}>
            Fix this →
          </Link>
        ) : null}
      </span>
    </li>
  );
}

export function PublishReadinessChecklist({
  readiness,
  hideWhenReady = false,
}: {
  readiness: PublishReadiness;
  /** When true, render nothing once every required item is done. */
  hideWhenReady?: boolean;
}) {
  if (readiness.ready && hideWhenReady) return null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {readiness.ready ? "✓ Ready to publish" : "Missing before publish"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {readiness.requiredDone}/{readiness.requiredTotal} required
        </span>
      </div>

      <Meter
        value={readiness.requiredDone}
        max={readiness.requiredTotal}
        tone={readiness.ready ? "success" : "warning"}
      />

      {readiness.ready ? (
        <p style={{ fontSize: 13, color: "#15803d", marginTop: 10, marginBottom: 0 }}>
          Everything required is in place. You&apos;re clear to publish and open enrollment.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
          {readiness.items
            .filter((i) => i.required)
            .map((item) => (
              <Row key={item.key} item={item} />
            ))}
        </ul>
      )}

      {readiness.recommended.length > 0 ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            {readiness.recommended.length} recommended improvement
            {readiness.recommended.length === 1 ? "" : "s"}
          </summary>
          <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
            {readiness.recommended.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
