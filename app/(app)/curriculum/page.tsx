import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getClassCatalog } from "@/lib/class-management-actions";
import { getLegacyLearnerFitCopy, getLearnerFitSummary } from "@/lib/learner-fit";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CurriculumSearchInput } from "./search-input";
import { getRecommendedClassOfferings, type StudentClassCard } from "@/lib/student-class-portal";
import { ClassCard, type ClassCardData } from "@/components/classes/class-card";

const LEGACY_LEARNER_FIT_FILTERS = ["LEVEL_101", "LEVEL_201", "LEVEL_301", "LEVEL_401"] as const;
const NOTICE_COPY: Record<string, string> = {
  "legacy-courses-root":
    "The older student Courses page has been folded into the Curriculum Catalog so discovery and enrollment stay in one place.",
};

type CatalogOffering = Awaited<ReturnType<typeof getClassCatalog>>[number];

function chapterLabelOf(chapter: { name: string; city: string | null } | null): string | null {
  if (!chapter) return null;
  return chapter.city ? `${chapter.name} (${chapter.city})` : chapter.name;
}

function catalogOfferingToCard(
  offering: CatalogOffering,
  myStatus: "ENROLLED" | "WAITLISTED" | null,
  fallbackPathways: { id: string; name: string }[],
): ClassCardData {
  const fit = getLearnerFitSummary({
    learnerFitLabel: offering.template.learnerFitLabel,
    learnerFitDescription: offering.template.learnerFitDescription,
    difficultyLevel: offering.template.difficultyLevel,
  });
  return {
    id: offering.id,
    title: offering.title,
    description: offering.template.description,
    interestArea: offering.template.interestArea,
    deliveryMode: offering.deliveryMode,
    learnerFitLabel: fit.label,
    learnerFitAccent: fit.accent,
    learnerFitDescription: fit.description,
    instructorName: offering.instructor.name,
    startDate: offering.startDate,
    endDate: offering.endDate,
    meetingDays: offering.meetingDays,
    meetingTime: offering.meetingTime,
    sessionCount: offering._count.sessions,
    locationName: offering.locationName,
    locationAddress: offering.locationAddress,
    capacity: offering.capacity,
    enrolledCount: offering._count.enrollments,
    enrollmentOpen: offering.enrollmentOpen,
    offeringStatus: offering.status,
    introVideoUrl: offering.introVideoUrl,
    chapterLabel: chapterLabelOf(offering.chapter),
    pathway: offering.pathwayStep?.pathway
      ? {
          id: offering.pathwayStep.pathway.id,
          name: offering.pathwayStep.pathway.name,
          stepOrder: offering.pathwayStep.stepOrder,
        }
      : null,
    fallbackPathways,
    learningOutcomes: offering.template.learningOutcomes,
    myStatus,
  };
}

function recommendedToCard(
  rec: StudentClassCard,
  myStatus: "ENROLLED" | "WAITLISTED" | null,
): ClassCardData {
  const fit = getLearnerFitSummary({
    learnerFitLabel: rec.template.learnerFitLabel,
    learnerFitDescription: rec.template.learnerFitDescription,
    difficultyLevel: rec.template.difficultyLevel,
  });
  return {
    id: rec.id,
    title: rec.title,
    description: rec.description,
    interestArea: rec.template.interestArea,
    deliveryMode: rec.deliveryMode,
    learnerFitLabel: fit.label,
    learnerFitAccent: fit.accent,
    learnerFitDescription: fit.description,
    instructorName: rec.instructor.name,
    startDate: rec.startDate,
    endDate: rec.endDate,
    meetingDays: rec.meetingDays,
    meetingTime: rec.meetingTime,
    sessionCount: null,
    locationName: rec.locationName,
    locationAddress: rec.locationAddress,
    capacity: rec.capacity,
    enrolledCount: rec.enrolledCount,
    enrollmentOpen: rec.enrollmentOpen,
    offeringStatus: null,
    introVideoUrl: rec.introVideoUrl,
    chapterLabel: rec.chapterLabel,
    isPartnerChapter: rec.isPartnerChapter,
    pathway: rec.pathway,
    fallbackPathways: [],
    learningOutcomes: rec.template.learningOutcomes,
    reasonLabel: rec.reasonLabel,
    myStatus,
  };
}

export default async function CurriculumPage({
  searchParams,
}: {
  searchParams: Promise<{
    interest?: string;
    level?: string;
    mode?: string;
    semester?: string;
    search?: string;
    notice?: string;
  }>;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const roles = session?.user?.roles ?? [];
  const isInstructor = roles.includes("INSTRUCTOR") || roles.includes("ADMIN");
  const isStudent = roles.includes("STUDENT");
  const notice = params.notice ? NOTICE_COPY[params.notice] : null;
  const hasFilters = Boolean(
    params.search || params.interest || params.level || params.mode || params.semester,
  );

  const [offerings, activePathways, myEnrollments, recommendedOfferings] = await Promise.all([
    getClassCatalog({
      interestArea: params.interest,
      difficultyLevel: params.level,
      deliveryMode: params.mode,
      semester: params.semester,
      search: params.search,
      userId: session.user.id,
    }),
    prisma.pathway.findMany({
      where: { isActive: true },
      select: { id: true, name: true, interestArea: true },
    }),
    prisma.classEnrollment.findMany({
      where: {
        studentId: session.user.id,
        status: { in: ["ENROLLED", "WAITLISTED"] },
      },
      select: { offeringId: true, status: true },
    }),
    isStudent
      ? getRecommendedClassOfferings(session.user.id, {
          interestArea: params.interest,
          limit: 3,
        })
      : Promise.resolve([] as StudentClassCard[]),
  ]);

  const enrollmentByOfferingId = new Map(
    myEnrollments.map((e) => [e.offeringId, e.status as "ENROLLED" | "WAITLISTED"]),
  );

  // Build a lookup: interestArea → matching pathways
  const pathwayByArea = new Map<string, { id: string; name: string }[]>();
  for (const pw of activePathways) {
    const area = pw.interestArea.toLowerCase();
    if (!pathwayByArea.has(area)) pathwayByArea.set(area, []);
    pathwayByArea.get(area)!.push(pw);
  }

  const interestAreas = Array.from(new Set(offerings.map((o) => o.template.interestArea))).sort();
  const semesters = Array.from(
    new Set(offerings.filter((o) => o.semester).map((o) => o.semester!)),
  ).sort();

  const openCount = offerings.filter((o) => o.enrollmentOpen && o.capacity - o._count.enrollments > 0).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Curriculum</p>
          <h1 className="page-title">Class Catalog</h1>
          <p className="page-subtitle" style={{ maxWidth: 620, marginTop: 6, color: "var(--text-secondary)" }}>
            Free enrichment classes taught by trained YPP student instructors and supported by the
            YPP team. Browse, find your fit, and sign up — no cost, no catch.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isStudent && (
            <>
              <Link href="/my-classes" className="button secondary">
                My Classes
              </Link>
              <Link href="/curriculum/schedule" className="button secondary">
                My Schedule
              </Link>
            </>
          )}
          {isInstructor && (
            <Link href="/instructor/curriculum-builder" className="button primary">
              + Build Curriculum
            </Link>
          )}
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
          <strong style={{ color: "#1d4ed8" }}>Student class flow updated</strong>
          <p style={{ marginTop: 6, color: "var(--text-secondary)" }}>{notice}</p>
        </div>
      )}

      {isStudent && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h3 style={{ marginTop: 0 }}>Find classes your way</h3>
              <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>
                Start from your chapter, your pathway journey, or the full catalog. Every route feeds into the same
                class pages and one-tap enrollment.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
              <Link href="/my-chapter" className="button secondary">
                My Chapter
              </Link>
              <Link href="/pathways" className="button secondary">
                Pathways
              </Link>
              <Link href="/curriculum/recommended" className="button secondary">
                Recommended
              </Link>
            </div>
          </div>
        </div>
      )}

      {isStudent && recommendedOfferings.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            <div>
              <div className="section-title">Recommended for You</div>
              <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
                Based on your interests, your chapter, and the areas where you already have momentum.
              </p>
            </div>
            <Link href="/curriculum/recommended" style={{ color: "var(--ypp-purple)" }}>
              See all recommendations →
            </Link>
          </div>

          <div className="grid three">
            {recommendedOfferings.map((rec) => (
              <ClassCard
                key={rec.id}
                data={recommendedToCard(rec, enrollmentByOfferingId.get(rec.id) ?? null)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <CurriculumSearchInput defaultValue={params.search} />

        <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 14 }}>Browse by Learner Fit</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href="/curriculum"
            className="button secondary"
            style={{
              fontSize: 13,
              ...(!params.level ? { background: "var(--ypp-purple)", color: "white" } : {}),
            }}
          >
            All Learner Fits
          </Link>
          {LEGACY_LEARNER_FIT_FILTERS.map((value) => (
            <Link
              key={value}
              href={`/curriculum?level=${value}${params.interest ? `&interest=${params.interest}` : ""}${params.mode ? `&mode=${params.mode}` : ""}`}
              className="button secondary"
              style={{
                fontSize: 13,
                ...(params.level === value
                  ? {
                      background: getLegacyLearnerFitCopy(value).accent,
                      color: "white",
                      borderColor: getLegacyLearnerFitCopy(value).accent,
                    }
                  : {}),
              }}
            >
              {getLegacyLearnerFitCopy(value).label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          Learner fit explains who a class is best for. Prerequisites and age guidance still appear on each class page.
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {interestAreas.length > 0 && (
            <div>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Area:</span>
              {interestAreas.map((area) => (
                <Link
                  key={area}
                  href={`/curriculum?interest=${area}${params.level ? `&level=${params.level}` : ""}${params.mode ? `&mode=${params.mode}` : ""}`}
                  className="pill"
                  style={{
                    marginRight: 4,
                    textDecoration: "none",
                    ...(params.interest === area
                      ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                      : {}),
                  }}
                >
                  {area}
                </Link>
              ))}
            </div>
          )}

          <div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Mode:</span>
            {["IN_PERSON", "VIRTUAL", "HYBRID"].map((mode) => (
              <Link
                key={mode}
                href={`/curriculum?mode=${mode}${params.level ? `&level=${params.level}` : ""}${params.interest ? `&interest=${params.interest}` : ""}`}
                className="pill"
                style={{
                  marginRight: 4,
                  textDecoration: "none",
                  ...(params.mode === mode
                    ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                    : {}),
                }}
              >
                {mode === "VIRTUAL" ? "Online" : mode === "IN_PERSON" ? "In person" : "Hybrid"}
              </Link>
            ))}
          </div>
        </div>

        {semesters.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginRight: 8 }}>Semester:</span>
            {semesters.map((sem) => (
              <Link
                key={sem}
                href={`/curriculum?semester=${sem}${params.level ? `&level=${params.level}` : ""}`}
                className="pill"
                style={{
                  marginRight: 4,
                  textDecoration: "none",
                  ...(params.semester === sem
                    ? { background: "var(--ypp-purple-100)", color: "var(--ypp-purple)", fontWeight: 600 }
                    : {}),
                }}
              >
                {sem}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          {offerings.length} class{offerings.length !== 1 ? "es" : ""}
          {offerings.length > 0 ? ` · ${openCount} open for signup` : ""}
        </span>
        {hasFilters && (
          <Link href="/curriculum" style={{ fontSize: 13, color: "var(--ypp-purple)" }}>
            Clear Filters
          </Link>
        )}
      </div>

      {offerings.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">
            {hasFilters ? "🔍" : "🗓️"}
          </div>
          <h3 style={{ marginTop: 0 }}>
            {hasFilters ? "No classes match those filters" : "No classes are open right now"}
          </h3>
          <p style={{ color: "var(--text-secondary)", marginTop: 8, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
            {hasFilters
              ? "Try adjusting the subject or grade range, or clear filters to see everything available."
              : "Check back soon for new free enrichment opportunities. In the meantime, explore your pathway or the classes you're already in."}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, justifyContent: "center" }}>
            {hasFilters && (
              <Link href="/curriculum" className="button primary">
                Clear filters
              </Link>
            )}
            {isStudent && (
              <Link href="/my-classes" className="button secondary">
                View your classes
              </Link>
            )}
            <Link href="/pathways" className="button secondary">
              Explore pathways
            </Link>
            <Link href="/help" className="button secondary">
              Contact YPP
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid two">
          {offerings.map((offering) => {
            const fallbackPathways = offering.pathwayStep?.pathway
              ? []
              : pathwayByArea.get(offering.template.interestArea.toLowerCase()) ?? [];
            return (
              <ClassCard
                key={offering.id}
                data={catalogOfferingToCard(
                  offering,
                  enrollmentByOfferingId.get(offering.id) ?? null,
                  fallbackPathways,
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
