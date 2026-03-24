import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FallbackReviewButtons } from "./fallback-review-buttons";

type FallbackRequestRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: Date;
  reviewedAt: Date | null;
  note: string | null;
  student: { name: string };
  pathway: { id: string; name: string; interestArea: string };
  pathwayStep: {
    id: string;
    stepOrder: number;
    title: string | null;
    classTemplate: { title: string } | null;
  };
  fromChapter: { id: string; name: string; city: string | null; region: string | null } | null;
  toChapter: { id: string; name: string; city: string | null; region: string | null } | null;
  targetOffering:
    | {
        id: string;
        title: string;
        startDate: Date;
        endDate: Date;
        meetingDays: string[];
        meetingTime: string;
        deliveryMode: "IN_PERSON" | "VIRTUAL" | "HYBRID";
        locationName: string | null;
        locationAddress: string | null;
        chapter: { name: string | null } | null;
      }
    | null;
  reviewedBy: { name: string | null } | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: string) {
  switch (status) {
    case "APPROVED":
      return { background: "#dcfce7", color: "#166534" };
    case "REJECTED":
      return { background: "#fee2e2", color: "#991b1b" };
    case "PENDING":
      return { background: "#e0f2fe", color: "#075985" };
    case "CANCELLED":
      return { background: "#f3f4f6", color: "#374151" };
    default:
      return { background: "#f3f4f6", color: "#374151" };
  }
}

export default async function ChapterPathwayFallbacksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const roles = new Set(session.user.roles ?? []);
  const canReview = roles.has("ADMIN") || roles.has("STAFF") || roles.has("CHAPTER_PRESIDENT");
  if (!canReview) redirect("/my-chapter");

  const reviewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { chapterId: true, chapter: { select: { name: true } } },
  });

  const fallbackWhere: any =
    roles.has("ADMIN") || roles.has("STAFF")
      ? {}
      : {
          OR: [
            reviewer?.chapterId ? { fromChapterId: reviewer.chapterId } : undefined,
            reviewer?.chapterId ? { toChapterId: reviewer.chapterId } : undefined,
          ].filter(Boolean),
        };

  const fallbackRequestModel = (prisma as any).pathwayFallbackRequest;
  const fallbackRequests = (await fallbackRequestModel.findMany({
    where: fallbackWhere,
    include: {
      student: { select: { name: true } },
      pathway: { select: { id: true, name: true, interestArea: true } },
      pathwayStep: {
        select: {
          id: true,
          stepOrder: true,
          title: true,
          classTemplate: { select: { title: true } },
        },
      },
      fromChapter: { select: { id: true, name: true, city: true, region: true } },
      toChapter: { select: { id: true, name: true, city: true, region: true } },
      targetOffering: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          meetingDays: true,
          meetingTime: true,
          deliveryMode: true,
          locationName: true,
          locationAddress: true,
          chapter: { select: { name: true } },
        },
      },
      reviewedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })) as FallbackRequestRow[];

  const pendingCount = fallbackRequests.filter((request) => request.status === "PENDING").length;
  const approvedCount = fallbackRequests.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = fallbackRequests.filter((request) => request.status === "REJECTED").length;

  const pendingRequests = fallbackRequests.filter((request) => request.status === "PENDING");
  const decidedRequests = fallbackRequests.filter((request) => request.status !== "PENDING");

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">Chapter Review</p>
          <h1 className="page-title">Pathway fallback requests</h1>
          <p style={{ margin: "6px 0 0", color: "var(--gray-600)" }}>
            {reviewer?.chapter?.name
              ? `Review requests for ${reviewer.chapter.name}.`
              : "Review partner-chapter requests, approvals, and declines."}
          </p>
        </div>
        <Link href="/my-chapter" className="button outline small">
          Back to My Chapter
        </Link>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>What this page is for</h3>
          <p style={{ marginBottom: 0, color: "var(--gray-600)" }}>
            Students can ask for access to a partner chapter offering when their local chapter does
            not have the next step. This queue lets chapter presidents, staff, and admins approve or deny
            those requests without opening unrestricted cross-chapter enrollment.
          </p>
        </div>
        <div className="card">
          <div className="grid two" style={{ gap: 12 }}>
            <div>
              <div className="kpi">{pendingCount}</div>
              <div className="kpi-label">Pending</div>
            </div>
            <div>
              <div className="kpi">{approvedCount}</div>
              <div className="kpi-label">Approved</div>
            </div>
            <div>
              <div className="kpi">{rejectedCount}</div>
              <div className="kpi-label">Rejected</div>
            </div>
            <div>
              <div className="kpi">{fallbackRequests.length}</div>
              <div className="kpi-label">Total requests</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="section-title">Pending review</div>
        {pendingRequests.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--gray-600)" }}>
              No fallback requests are waiting right now.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {pendingRequests.map((request) => (
              <section key={request.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill" style={statusTone(request.status)}>
                        Pending
                      </span>
                      <span className="pill">{request.pathway.interestArea}</span>
                    </div>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                      {request.student.name} wants {request.pathwayStep.classTemplate?.title ?? request.pathwayStep.title}
                    </h3>
                    <p style={{ marginTop: 0, color: "var(--gray-600)" }}>
                      {request.pathway.name} · Step {request.pathwayStep.stepOrder}
                    </p>
                    <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
                      From{" "}
                      {request.fromChapter
                        ? `${request.fromChapter.name}${request.fromChapter.city ? ` (${request.fromChapter.city})` : ""}`
                        : "their current chapter"}
                      {" "}to{" "}
                      {request.toChapter
                        ? `${request.toChapter.name}${request.toChapter.city ? ` (${request.toChapter.city})` : ""}`
                        : "the partner chapter"}
                    </p>
                    {request.note ? (
                      <p style={{ marginBottom: 0, color: "var(--gray-600)", fontSize: 14 }}>
                        Note: {request.note}
                      </p>
                    ) : null}
                  </div>

                  <div style={{ minWidth: 220 }}>
                    <div style={{ fontSize: 13, color: "var(--gray-500)" }}>
                      Requested {formatDate(request.createdAt)}
                    </div>
                    {request.targetOffering ? (
                      <div style={{ marginTop: 8, fontSize: 13, color: "var(--gray-600)" }}>
                        Target class:{" "}
                        <Link href={`/curriculum/${request.targetOffering.id}`} style={{ color: "var(--ypp-purple)" }}>
                          {request.targetOffering.title}
                        </Link>
                        <br />
                        {request.targetOffering.meetingDays.join(", ")} · {request.targetOffering.meetingTime}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/pathways/${request.pathway.id}`} className="button outline small">
                      View pathway
                    </Link>
                    {request.targetOffering ? (
                      <Link href={`/curriculum/${request.targetOffering.id}`} className="button outline small">
                        View class
                      </Link>
                    ) : null}
                  </div>
                  <FallbackReviewButtons requestId={request.id} />
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="section-title">Recent decisions</div>
        {decidedRequests.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--gray-600)" }}>
              No approved or rejected requests are in the archive yet.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {decidedRequests.map((request) => (
              <section key={request.id} className="card" style={{ opacity: 0.95 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill" style={statusTone(request.status)}>
                        {request.status}
                      </span>
                      <span className="pill">{request.pathway.name}</span>
                    </div>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>
                      {request.student.name} · Step {request.pathwayStep.stepOrder}
                    </h3>
                    <p style={{ marginTop: 0, color: "var(--gray-600)", fontSize: 14 }}>
                      {request.pathwayStep.classTemplate?.title ?? request.pathwayStep.title}
                    </p>
                  </div>
                  <div style={{ minWidth: 220, fontSize: 13, color: "var(--gray-500)" }}>
                    Requested {formatDate(request.createdAt)}
                    <br />
                    Reviewed {request.reviewedAt ? formatDate(request.reviewedAt) : "Not yet"}
                    <br />
                    {request.reviewedBy?.name ? `By ${request.reviewedBy.name}` : "No reviewer recorded"}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
