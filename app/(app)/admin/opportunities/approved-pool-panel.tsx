import Link from "next/link";
import type { ApprovedUnplacedCandidate } from "@/lib/workshop-proposal-pool";

/**
 * Sidebar / banner that surfaces approved Summer Workshop instructors who
 * are waiting for a placement. Read-only — admins click through to the
 * submission detail (where they can see the full proposal) or to the
 * assignment board to actually wire someone up.
 *
 * Designed to render zero chrome when the pool is empty so opportunities
 * admins don't see noise when every approved instructor is already placed.
 */
export function ApprovedPoolPanel({
  candidates,
}: {
  candidates: ApprovedUnplacedCandidate[];
}) {
  if (candidates.length === 0) return null;
  return (
    <section
      className="card"
      style={{
        marginBottom: 20,
        borderColor: "#a78bfa",
        background:
          "linear-gradient(135deg, rgba(245,243,255,0.6) 0%, rgba(253,244,255,0.6) 100%)",
      }}
      aria-label="Approved Summer Workshop instructors awaiting placement"
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 16, color: "#5b21b6" }}>
            Approved · waiting for a placement
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "#5b21b6",
              lineHeight: 1.5,
            }}
          >
            These Summer Workshop Instructors are ready to teach. Match them to
            an opportunity below, or open their proposal for the full plan.
          </p>
        </div>
        <Link
          href="/admin/workshop-reviews?status=APPROVED&assignment=unassigned"
          className="link"
          style={{ fontSize: 13, color: "#5b21b6" }}
        >
          See full list →
        </Link>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 8,
        }}
      >
        {candidates.map((c) => (
          <li key={c.submissionId}>
            <Link
              href={`/admin/workshop-reviews/${c.submissionId}`}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                padding: 10,
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #ddd6fe",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {c.applicantName ?? c.applicantEmail ?? "Workshop instructor"}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.workshopTitle ?? "Workshop proposal"}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                {[c.category, c.ageRange, c.chapterName, c.sourceLabel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
