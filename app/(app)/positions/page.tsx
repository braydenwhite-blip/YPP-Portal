import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { PositionType, PositionVisibility } from "@prisma/client";

const POSITION_TYPE_OPTIONS: PositionType[] = [
  "INSTRUCTOR",
  "MENTOR",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "GLOBAL_ADMIN",
];

type PositionFilters = {
  chapter?: string;
  type?: string;
  visibility?: string;
  status?: string;
};

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function getDeadlineUrgency(deadline: Date | null): { label: string; color: string; bg: string } | null {
  if (!deadline) return null;
  const now = new Date();
  const diff = new Date(deadline).getTime() - now.getTime();
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Deadline passed", color: "#991b1b", bg: "#fee2e2" };
  if (daysLeft === 0) return { label: "Closes today!", color: "#991b1b", bg: "#fee2e2" };
  if (daysLeft === 1) return { label: "Closes tomorrow", color: "#92400e", bg: "#fef3c7" };
  if (daysLeft <= 3) return { label: `${daysLeft} days left`, color: "#92400e", bg: "#fef3c7" };
  if (daysLeft <= 7) return { label: `${daysLeft} days left`, color: "#1e40af", bg: "#eff6ff" };
  return null;
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  if (!value) return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<PositionFilters>;
}) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);

  const currentUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          chapterId: true,
          roles: { select: { role: true } },
        },
      })
    : null;

  const roles = currentUser?.roles.map((role) => role.role) ?? [];
  const isPrivileged = roles.some((role) => ["ADMIN", "CHAPTER_LEAD", "STAFF"].includes(role));

  const selectedType = normalizeEnum(params.type, POSITION_TYPE_OPTIONS);
  const selectedVisibility = normalizeEnum(params.visibility, [
    "CHAPTER_ONLY",
    "NETWORK_WIDE",
    "PUBLIC",
  ] as const);
  const selectedStatus = params.status === "closed" || params.status === "all" ? params.status : "open";
  const selectedChapter = params.chapter && params.chapter !== "all" ? params.chapter : null;

  const [chapters, positions, userApplications] = await Promise.all([
    prisma.chapter.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: {
        ...(selectedType ? { type: selectedType } : {}),
        ...(selectedVisibility ? { visibility: selectedVisibility } : {}),
        ...(selectedChapter ? { chapterId: selectedChapter } : {}),
        ...(selectedStatus === "open"
          ? { isOpen: true }
          : selectedStatus === "closed"
            ? { isOpen: false }
            : {}),
      },
      include: {
        chapter: { select: { id: true, name: true, city: true } },
        _count: { select: { applications: true } },
      },
      orderBy: [{ isOpen: "desc" }, { createdAt: "desc" }],
    }),
    currentUser
      ? prisma.application.findMany({
          where: { applicantId: currentUser.id },
          select: { positionId: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  const appliedPositions = new Map(userApplications.map((application) => [application.positionId, application.status]));

  const visiblePositions = positions.filter((position) => {
    if (isPrivileged) return true;
    if (position.visibility === "PUBLIC") return true;
    if (position.visibility === "NETWORK_WIDE") return Boolean(currentUser?.id);
    if (position.visibility === "CHAPTER_ONLY") {
      return Boolean(currentUser?.chapterId && currentUser.chapterId === position.chapterId);
    }
    return false;
  });

  const totalOpen = visiblePositions.filter((position) => position.isOpen).length;
  const totalClosed = visiblePositions.filter((position) => !position.isOpen).length;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Careers</p>
          <h1 className="page-title">Open Positions</h1>
          <p className="page-subtitle">
            Chapter hiring and network roles in one searchable list.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {session?.user ? (
            <Link href="/chapters/propose" className="button small ghost" style={{ textDecoration: "none" }}>
              Propose Chapter
            </Link>
          ) : null}
          {isPrivileged ? (
            <Link href="/positions/new" className="button small outline" style={{ textDecoration: "none" }}>
              + New Opening
            </Link>
          ) : null}
          {session?.user ? (
            <Link href="/applications" className="button small" style={{ textDecoration: "none" }}>
              My Applications
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form className="form-grid" method="get">
          <div className="grid four">
            <label className="form-row">
              Chapter
              <select className="input" name="chapter" defaultValue={selectedChapter ?? "all"}>
                <option value="all">All Chapters</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Role Type
              <select className="input" name="type" defaultValue={selectedType ?? ""}>
                <option value="">All Types</option>
                {POSITION_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Visibility
              <select className="input" name="visibility" defaultValue={selectedVisibility ?? ""}>
                <option value="">All Visibility</option>
                {(["CHAPTER_ONLY", "NETWORK_WIDE", "PUBLIC"] as PositionVisibility[]).map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {visibility.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-row">
              Status
              <select className="input" name="status" defaultValue={selectedStatus}>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="button small">
              Apply Filters
            </button>
            <Link href="/positions" className="button small ghost" style={{ textDecoration: "none" }}>
              Reset
            </Link>
          </div>
        </form>
      </div>

      <div className="grid three" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="kpi">{totalOpen}</div>
          <div className="kpi-label">Open</div>
        </div>
        <div className="card">
          <div className="kpi">{totalClosed}</div>
          <div className="kpi-label">Closed</div>
        </div>
        <div className="card">
          <div className="kpi">{visiblePositions.length}</div>
          <div className="kpi-label">Visible to You</div>
        </div>
      </div>

      {visiblePositions.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>
            No positions match your current filters.
          </p>
        </div>
      ) : (
        <div className="grid two">
          {visiblePositions.map((position) => {
            const applicationStatus = appliedPositions.get(position.id);
            const hasApplied = Boolean(applicationStatus);

            return (
              <div key={position.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{position.title}</h3>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span className="pill">{position.type.replace(/_/g, " ")}</span>
                      {position.chapter ? (
                        <span className="pill pill-pathway">Chapter Hiring: {position.chapter.name}</span>
                      ) : (
                        <span className="pill">Network Role</span>
                      )}
                      <span className="pill">{position.visibility.replace(/_/g, " ")}</span>
                      {position.interviewRequired ? (
                        <span className="pill pill-pathway">Interview Required</span>
                      ) : (
                        <span className="pill pill-success">No Interview</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                    <span className={`pill ${position.isOpen ? "pill-success" : "pill-declined"}`}>
                      {position.isOpen ? "OPEN" : "CLOSED"}
                    </span>
                    {hasApplied ? (
                      <span
                        className={`pill ${
                          applicationStatus === "ACCEPTED"
                            ? "pill-success"
                            : applicationStatus === "REJECTED" || applicationStatus === "WITHDRAWN"
                              ? "pill-declined"
                              : ""
                        }`}
                      >
                        {applicationStatus?.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </div>
                </div>

                {position.description ? (
                  <p style={{ margin: "12px 0", color: "var(--muted)", fontSize: 14 }}>
                    {position.description.slice(0, 170)}
                    {position.description.length > 170 ? "..." : ""}
                  </p>
                ) : null}

                <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", display: "grid", gap: 4 }}>
                  <span>Interview: {position.interviewRequired ? "Required" : "Optional"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Application Deadline: {formatDate(position.applicationDeadline)}
                    {(() => {
                      const urgency = getDeadlineUrgency(position.applicationDeadline);
                      if (!urgency) return null;
                      return (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: urgency.color,
                          background: urgency.bg,
                          padding: "1px 8px",
                          borderRadius: 10,
                        }}>
                          {urgency.label}
                        </span>
                      );
                    })()}
                  </span>
                  <span>Target Start Date: {formatDate(position.targetStartDate)}</span>
                  <span>
                    {position._count.applications} application{position._count.applications !== 1 ? "s" : ""}
                  </span>
                </div>

                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {!position.isOpen ? (
                    <span style={{ fontSize: 12, color: "#b45309" }}>This position is currently closed.</span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Applications are currently open.</span>
                  )}
                  <Link href={`/positions/${position.id}`} className="button small" style={{ textDecoration: "none" }}>
                    {hasApplied ? "View Details" : "Learn More"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
