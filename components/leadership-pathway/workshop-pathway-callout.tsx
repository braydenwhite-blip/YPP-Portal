import Link from "next/link";

interface WorkshopPathwayCalloutProps {
  isCurrentWorkshopInstructor: boolean;
}

/**
 * One-line workshop framing. Lives only on the workshop studio so
 * workshop instructors know they're on a real path forward — not a
 * parking lot. Pathway page does its own framing.
 */
export function WorkshopPathwayCallout({
  isCurrentWorkshopInstructor,
}: WorkshopPathwayCalloutProps) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderLeft: "3px solid #7c3aed",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeftWidth: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        fontSize: 13,
        color: "var(--text)",
      }}
    >
      <span>
        {isCurrentWorkshopInstructor
          ? "You're on the workshop pathway. Exceptional workshop instructors are invited into the full Instructor role."
          : "Workshop instructors join through a lighter-weight pathway with a clear path into the full Instructor role."}
      </span>
      <Link
        href="/leadership-pathway"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#5b21b6",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        See the pathway →
      </Link>
    </div>
  );
}
