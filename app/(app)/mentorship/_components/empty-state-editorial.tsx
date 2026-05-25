import Link from "next/link";

interface EmptyStateEditorialProps {
  title: string;
  body: string;
  link?: {
    label: string;
    href: string;
  };
}

/**
 * Editorial empty-state pattern — Playfair h2, Lora body, one quiet
 * text link. No card chrome. Used for the three mentorship empty
 * cases: not paired with a mentor yet, mentor with no mentees yet,
 * and neither-role.
 *
 * Designed to feel intentional rather than deficient. The current
 * pages use generic centered cards; this treatment elevates the
 * moment without adding noise.
 */
export function EmptyStateEditorial({
  title,
  body,
  link,
}: EmptyStateEditorialProps) {
  return (
    <section
      style={{
        padding: "40px 8px",
        maxWidth: "60ch",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-playfair), Georgia, serif",
          fontSize: "clamp(26px, 4vw, 36px)",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--ypp-purple-800)",
          margin: 0,
          lineHeight: 1.15,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "var(--font-lora), Georgia, serif",
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--text)",
          margin: "18px 0 0",
        }}
      >
        {body}
      </p>
      {link && (
        <Link
          href={link.href}
          style={{
            display: "inline-block",
            marginTop: 20,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          {link.label} →
        </Link>
      )}
    </section>
  );
}
