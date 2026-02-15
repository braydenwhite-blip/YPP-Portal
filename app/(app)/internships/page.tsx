import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInternshipListings } from "@/lib/real-world-actions";
import Link from "next/link";
import { ApplyButton, CreateListingButton } from "./client";

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: { passionArea?: string; type?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { listings, myAppMap } = await getInternshipListings({
    passionArea: searchParams.passionArea,
    type: searchParams.type,
  });

  const isAdmin = session.user.roles?.includes("ADMIN");
  const isInstructor = session.user.roles?.includes("INSTRUCTOR");

  const typeColors: Record<string, string> = {
    IN_PERSON: "#16a34a",
    REMOTE: "#3b82f6",
    HYBRID: "#d97706",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Internship & Opportunity Board</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Real-world opportunities to apply your passion
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <Link href="/positions" className="link" style={{ fontSize: 13 }}>
              Leadership & Instructor Openings
            </Link>
            <Link href="/applications" className="link" style={{ fontSize: 13 }}>
              My Applications
            </Link>
          </div>
        </div>
        {(isAdmin || isInstructor) && <CreateListingButton />}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Filter:</span>
        {["IN_PERSON", "REMOTE", "HYBRID"].map((t) => (
          <Link
            key={t}
            href={`/internships?type=${t}${searchParams.passionArea ? `&passionArea=${searchParams.passionArea}` : ""}`}
            className="pill"
            style={{
              background: searchParams.type === t ? `${typeColors[t]}15` : "var(--surface-alt)",
              color: searchParams.type === t ? typeColors[t] : "var(--text-secondary)",
              fontWeight: searchParams.type === t ? 600 : 400,
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            {t.replace("_", " ")}
          </Link>
        ))}
        {(searchParams.type || searchParams.passionArea) && (
          <Link href="/internships" style={{ fontSize: 12, color: "var(--ypp-purple)" }}>
            Clear filters
          </Link>
        )}
      </div>

      {/* Listings */}
      {listings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {listings.map((listing) => {
            const myStatus = myAppMap[listing.id];
            const daysUntilDeadline = listing.deadline
              ? Math.ceil((new Date(listing.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const color = typeColors[listing.type] || "#6b7280";

            return (
              <div key={listing.id} className="card" style={{ borderLeft: `4px solid ${color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
                        {listing.type.replace("_", " ")}
                      </span>
                      {listing.isPaid && (
                        <span className="pill" style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 600 }}>
                          Paid
                        </span>
                      )}
                      {listing.passionArea && (
                        <span className="pill" style={{ fontSize: 11 }}>{listing.passionArea}</span>
                      )}
                    </div>
                    <h3 style={{ margin: "4px 0" }}>
                      <Link href={`/internships/${listing.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {listing.title}
                      </Link>
                    </h3>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {listing.organization}
                      {listing.location && ` | ${listing.location}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    {daysUntilDeadline != null && daysUntilDeadline > 0 && (
                      <div style={{ fontSize: 12, color: daysUntilDeadline <= 7 ? "#ef4444" : "var(--text-secondary)" }}>
                        {daysUntilDeadline} days left
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {listing._count.applications} applicants
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "8px 0" }}>
                  {listing.description.length > 200
                    ? listing.description.slice(0, 200) + "..."
                    : listing.description}
                </p>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                  {listing.duration && <span>Duration: <strong>{listing.duration}</strong></span>}
                  {listing.hoursPerWeek && <span>Hours: <strong>{listing.hoursPerWeek}/week</strong></span>}
                  {listing.compensation && <span>Pay: <strong>{listing.compensation}</strong></span>}
                  {listing.ageRange && <span>Ages: <strong>{listing.ageRange}</strong></span>}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Posted by {listing.postedBy.name}
                  </span>
                  {myStatus ? (
                    <span className="pill" style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: myStatus === "ACCEPTED" ? "#dcfce7" : myStatus === "REJECTED" ? "#fee2e2" : "var(--ypp-purple-50)",
                      color: myStatus === "ACCEPTED" ? "#16a34a" : myStatus === "REJECTED" ? "#ef4444" : "var(--ypp-purple)",
                    }}>
                      {myStatus}
                    </span>
                  ) : (
                    <Link href={`/internships/${listing.id}`} className="button primary small">
                      View & Apply
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <h3>No Opportunities Listed</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Check back soon for new internships and opportunities!
          </p>
        </div>
      )}
    </div>
  );
}
