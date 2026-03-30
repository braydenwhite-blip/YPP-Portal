import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { getLearnerFitSummary } from "@/lib/learner-fit";
import { getRecommendedClassOfferings } from "@/lib/student-class-portal";

const NOTICE_COPY: Record<string, string> = {
  "legacy-recommended":
    "Recommended classes now live inside the curriculum flow, so your discovery and enrollment path stay in one place.",
};

export default async function RecommendedCurriculumPage({
  searchParams,
}: {
  searchParams?: Promise<{
    notice?: string;
    interest?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = (await searchParams) ?? {};
  const interest = params.interest ? decodeURIComponent(params.interest) : undefined;
  const offerings = await getRecommendedClassOfferings(session.user.id, {
    interestArea: interest,
    limit: 8,
  });
  const notice = params.notice ? NOTICE_COPY[params.notice] : null;

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/curriculum" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            &larr; Back to Catalog
          </Link>
          <h1 className="page-title" style={{ marginTop: 4 }}>
            {interest ? `${interest} Recommendations` : "Recommended Classes"}
          </h1>
          <p className="page-subtitle">
            Picks based on your interests, chapter, and the areas where you already have momentum.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-classes" className="button secondary">
            My Classes
          </Link>
          <Link href="/pathways" className="button secondary">
            Pathways
          </Link>
        </div>
      </div>

      {notice && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: "#eff6ff",
            borderLeft: "4px solid #2563eb",
          }}
        >
          <strong style={{ color: "#1d4ed8" }}>Recommendations moved</strong>
          <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>{notice}</p>
        </div>
      )}

      {offerings.length === 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>No recommendations yet</h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
            Browse the catalog, update your interests, or join a pathway to help the portal suggest stronger next classes.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <Link href="/curriculum" className="button primary">
              Browse All Classes
            </Link>
            <Link href="/pathways" className="button secondary">
              Explore Pathways
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid two">
          {offerings.map((offering) => {
            const learnerFit = getLearnerFitSummary({
              learnerFitLabel: offering.template.learnerFitLabel,
              learnerFitDescription: offering.template.learnerFitDescription,
              difficultyLevel: offering.template.difficultyLevel,
            });

            return (
              <Link
                key={offering.id}
                href={`/curriculum/${offering.id}`}
                className="card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <span
                    className="pill"
                    style={{
                      background: learnerFit.accent + "18",
                      color: learnerFit.accent,
                      fontWeight: 600,
                    }}
                  >
                    {learnerFit.label}
                  </span>
                  <span className="pill">{offering.template.interestArea}</span>
                  <span className="pill">{offering.deliveryMode.replace("_", " ")}</span>
                  {offering.reasonLabel ? (
                    <span className="pill pill-info">{offering.reasonLabel}</span>
                  ) : null}
                </div>

                <h3 style={{ marginTop: 0 }}>{offering.title}</h3>
                <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 14 }}>
                  {offering.description.slice(0, 150)}
                  {offering.description.length > 150 ? "..." : ""}
                </p>

                {offering.recommendationReasons.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                      Why this is showing up
                    </div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-secondary)", fontSize: 13 }}>
                      {offering.recommendationReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
                  <div>{offering.instructor.name}</div>
                  <div style={{ marginTop: 4 }}>
                    {offering.meetingDays.join(", ")} | {offering.meetingTime}
                  </div>
                  {offering.nextSession ? (
                    <div style={{ marginTop: 4, color: "var(--ypp-purple)", fontWeight: 600 }}>
                      Next:{" "}
                      {offering.nextSession.date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      at {offering.nextSession.startTime}
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
