import Link from "next/link";
import { GROWTH_MODEL, GROWTH_MODEL_ORDER } from "@/lib/growth-model";

/**
 * Compact "how your growth fits together" strip. Renders the shared growth
 * model (Pathway → Mentorship → Goals → Monthly review → Recognition) as one
 * connected row so a user understands the whole system at a glance without a
 * giant explainer paragraph repeated on every page.
 *
 * Keep this small and supporting — it reinforces the model, it is not a
 * page's primary content.
 */
export function GrowthModelStrip({ title }: { title?: string }) {
  return (
    <section
      aria-label={title ?? "How your growth fits together"}
      style={{ display: "grid", gap: 10 }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {title ?? "How your growth fits together"}
      </p>
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        {GROWTH_MODEL_ORDER.map((key, idx) => {
          const piece = GROWTH_MODEL[key];
          const inner = (
            <>
              <strong style={{ fontSize: "0.82rem" }}>{piece.label}</strong>
              <span className="muted" style={{ fontSize: "0.74rem", lineHeight: 1.4 }}>
                {piece.meaning}
              </span>
            </>
          );
          return (
            <li
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 180px" }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 2,
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: "var(--surface-alt, #f8fafc)",
                  border: "1px solid var(--border)",
                }}
              >
                {piece.href ? (
                  <Link href={piece.href} style={{ textDecoration: "none", color: "inherit", display: "grid", gap: 2 }}>
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </div>
              {idx < GROWTH_MODEL_ORDER.length - 1 ? (
                <span aria-hidden className="muted" style={{ fontSize: "1rem" }}>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default GrowthModelStrip;
