import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PositionType } from "@prisma/client";
import ApplicationsView from "./applications-view";

type ApplicationFilters = {
  type?: string;
  chapterProposal?: string;
};

const POSITION_TYPES: PositionType[] = [
  "INSTRUCTOR",
  "CHAPTER_PRESIDENT",
  "MENTOR",
  "STAFF",
  "GLOBAL_ADMIN",
];

function normalizeType(value: string | undefined): PositionType | null {
  if (!value) return null;
  return POSITION_TYPES.includes(value as PositionType) ? (value as PositionType) : null;
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<ApplicationFilters>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const roles = session?.user?.roles ?? [];

  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const selectedType = normalizeType(params.type);
  const chapterProposalOnly = params.chapterProposal === "true";

  const applications = await prisma.application.findMany({
    where: {
      ...(selectedType ? { position: { type: selectedType } } : {}),
      ...(chapterProposalOnly
        ? {
            position: {
              ...(selectedType ? { type: selectedType } : {}),
              chapterId: null,
              type: "CHAPTER_PRESIDENT",
            },
          }
        : {}),
    },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      position: {
        include: {
          chapter: {
            select: { name: true },
          },
        },
      },
      interviewSlots: {
        orderBy: { scheduledAt: "asc" },
      },
      decision: {
        select: { accepted: true, decidedAt: true, hiringChairStatus: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const statusCounts = {
    submitted: applications.filter((a) => a.status === "SUBMITTED").length,
    inReview: applications.filter((a) => a.status === "UNDER_REVIEW").length,
    interviewing: applications.filter((a) =>
      ["INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(a.status),
    ).length,
    accepted: applications.filter((a) => a.status === "ACCEPTED").length,
    rejected: applications.filter((a) => a.status === "REJECTED").length,
  };

  // Serialize dates for client components
  const serialized = applications.map((app) => ({
    ...app,
    submittedAt: app.submittedAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    interviewSlots: app.interviewSlots.map((slot) => ({
      ...slot,
      scheduledAt: slot.scheduledAt.toISOString(),
      confirmedAt: slot.confirmedAt?.toISOString() ?? null,
      completedAt: slot.completedAt?.toISOString() ?? null,
      createdAt: slot.createdAt.toISOString(),
    })),
    decision: app.decision
      ? {
          ...app.decision,
          decidedAt: app.decision.decidedAt.toISOString(),
        }
      : null,
  }));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin</p>
          <h1 className="page-title">Application Pipeline</h1>
          <p className="page-subtitle">
            Review applications, manage interview scheduling, and monitor Chair-reviewed decisions.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          Interview execution is now centralized in Interview Command Center.
        </p>
        <Link href="/interviews?scope=hiring&view=team&state=needs_action" className="button small outline" style={{ textDecoration: "none" }}>
          Open Interview Command Center
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form method="get" className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Position Type
              <select className="input" name="type" defaultValue={selectedType ?? ""}>
                <option value="">All Types</option>
                {POSITION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Chapter Proposal Filter
              <select
                className="input"
                name="chapterProposal"
                defaultValue={chapterProposalOnly ? "true" : "false"}
              >
                <option value="false">All Applications</option>
                <option value="true">Only New Chapter Proposals</option>
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="button small">
              Apply Filters
            </button>
            <Link href="/admin/applications" className="button small ghost" style={{ textDecoration: "none" }}>
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="grid four">
        <div className="card">
          <div className="kpi">{applications.length}</div>
          <div className="kpi-label">Total</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCounts.submitted}</div>
          <div className="kpi-label">Submitted</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCounts.inReview}</div>
          <div className="kpi-label">In Review</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCounts.interviewing}</div>
          <div className="kpi-label">Interviewing</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCounts.accepted}</div>
          <div className="kpi-label">Accepted</div>
        </div>
        <div className="card">
          <div className="kpi">{statusCounts.rejected}</div>
          <div className="kpi-label">Rejected</div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <ApplicationsView applications={serialized as any} />
      </div>
    </div>
  );
}
