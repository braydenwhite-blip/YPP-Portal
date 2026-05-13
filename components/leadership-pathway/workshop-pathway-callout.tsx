import Link from "next/link";

interface WorkshopPathwayCalloutProps {
  /**
   * When true, the user is a workshop instructor *right now*. When false,
   * the callout is the broader "we welcome workshop alumni" framing used on
   * the leadership pathway page for everyone.
   */
  isCurrentWorkshopInstructor: boolean;
}

/**
 * The workshop pathway is part of the leadership ecosystem — not a parking
 * lot. This callout makes that explicit and tells the user (or anyone
 * reading the pathway page) what the path forward looks like.
 */
export function WorkshopPathwayCallout({
  isCurrentWorkshopInstructor,
}: WorkshopPathwayCalloutProps) {
  return (
    <div
      className="card"
      style={{
        padding: 16,
        background: "#f5f3ff",
        border: "1.5px solid #c4b5fd",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: "#7c3aed",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Workshop pathway
        </span>
        <h3 style={{ margin: 0, fontSize: 16, color: "#5b21b6" }}>
          {isCurrentWorkshopInstructor
            ? "You're entering a real leadership ecosystem."
            : "Workshop instructors are part of the same team."}
        </h3>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--text)",
        }}
      >
        {isCurrentWorkshopInstructor
          ? "Workshop instructors lead focused workshop experiences while getting oriented to YPP teaching, students, and culture. Exceptional workshop instructors are invited to transition into the full Instructor role — the same growth path that leads to Senior and Lead Instructor."
          : "We bring instructors into the YPP ecosystem through two pathways: full instructor onboarding and the lighter-weight workshop pathway. Workshop instructors are real members of the team — many of our strongest Instructors and Senior Instructors started in workshops."}
      </p>
      {isCurrentWorkshopInstructor && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.6)",
            border: "1px dashed #c4b5fd",
            fontSize: 12,
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: "#5b21b6" }}>What this looks like:</strong>{" "}
          Lead a great workshop. Build relationships with families and the
          team. Show up reliably. Talk to your mentor about whether full
          Instructor onboarding is the right next step.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link
          href="/leadership-pathway"
          className="button small secondary"
          style={{ background: "#fff", color: "#5b21b6", border: "1px solid #c4b5fd" }}
        >
          See the full pathway →
        </Link>
      </div>
    </div>
  );
}
