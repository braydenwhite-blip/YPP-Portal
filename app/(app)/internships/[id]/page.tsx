import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getInternshipDetail } from "@/lib/real-world-actions";
import Link from "next/link";
import { ApplyButton } from "../client";

export default async function InternshipDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const listing = await getInternshipDetail(params.id);
  if (!listing) redirect("/internships");

  const hasApplied = listing.applications.length > 0;
  const myApp = listing.applications[0];
  const requirements = Array.isArray(listing.requirements) ? listing.requirements as string[] : [];
  const daysUntilDeadline = listing.deadline
    ? Math.ceil((new Date(listing.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const typeColors: Record<string, string> = {
    IN_PERSON: "#16a34a",
    REMOTE: "#3b82f6",
    HYBRID: "#d97706",
  };
  const color = typeColors[listing.type] || "#6b7280";

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/internships" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; All Opportunities
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>{listing.title}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span className="pill" style={{ background: `${color}15`, color, fontSize: 11, fontWeight: 600 }}>
              {listing.type.replace("_", " ")}
            </span>
            {listing.isPaid && (
              <span className="pill" style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11, fontWeight: 600 }}>Paid</span>
            )}
            {listing.passionArea && (
              <span className="pill" style={{ fontSize: 11 }}>{listing.passionArea}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Main */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>{listing.organization}</h3>
            {listing.location && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                {listing.location}
              </div>
            )}
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {listing.description}
            </div>
          </div>

          {requirements.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Requirements</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {requirements.map((req, i) => (
                  <li key={i} style={{ fontSize: 14, marginBottom: 4 }}>{String(req)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Application */}
          {listing.status === "OPEN" && !hasApplied && (
            <div className="card">
              <ApplyButton listingId={listing.id} />
            </div>
          )}

          {hasApplied && myApp && (
            <div className="card" style={{
              borderLeft: `4px solid ${myApp.status === "ACCEPTED" ? "#16a34a" : myApp.status === "REJECTED" ? "#ef4444" : "var(--ypp-purple)"}`,
            }}>
              <h3>Your Application</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
                <span className="pill" style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: myApp.status === "ACCEPTED" ? "#dcfce7" : myApp.status === "REJECTED" ? "#fee2e2" : "var(--ypp-purple-50)",
                  color: myApp.status === "ACCEPTED" ? "#16a34a" : myApp.status === "REJECTED" ? "#ef4444" : "var(--ypp-purple)",
                }}>
                  {myApp.status}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Applied {new Date(myApp.appliedAt).toLocaleDateString()}
                </span>
              </div>
              {myApp.coverLetter && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                  {myApp.coverLetter}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ position: "sticky", top: 16 }}>
            <h4 style={{ marginBottom: 12 }}>Details</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {listing.duration && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Duration</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.duration}</div>
                </div>
              )}
              {listing.hoursPerWeek && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Hours/Week</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.hoursPerWeek}</div>
                </div>
              )}
              {listing.compensation && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Compensation</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.compensation}</div>
                </div>
              )}
              {listing.ageRange && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Age Range</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.ageRange}</div>
                </div>
              )}
              {daysUntilDeadline != null && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Deadline</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: daysUntilDeadline <= 7 ? "#ef4444" : undefined }}>
                    {new Date(listing.deadline!).toLocaleDateString()} ({daysUntilDeadline} days)
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Applicants</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{listing._count.applications}</div>
              </div>
              {listing.contactName && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Contact</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{listing.contactName}</div>
                  {listing.contactEmail && (
                    <div style={{ fontSize: 12, color: "var(--ypp-purple)" }}>{listing.contactEmail}</div>
                  )}
                </div>
              )}
              {listing.applicationUrl && (
                <a
                  href={listing.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button secondary"
                  style={{ textAlign: "center", marginTop: 8 }}
                >
                  External Application
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
