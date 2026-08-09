import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeaderV2, ButtonLink, CardV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  chapterMakeDecision,
  closeChapterPosition,
  reopenChapterPosition,
  updatePositionVisibility,
} from "@/lib/application-actions";
import { normalizeRoleList } from "@/lib/authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recruiting — Pathways Portal" };

const RECRUITING_TABS = ["positions", "candidates", "decisions"] as const;
type RecruitingTab = (typeof RECRUITING_TABS)[number];

const TAB_LABELS: Record<RecruitingTab, string> = {
  positions: "Positions",
  candidates: "Candidates",
  decisions: "Decisions",
};

function resolveRecruitingTab(rawTab: string | undefined): RecruitingTab {
  if (!rawTab) return "positions";
  const normalized = rawTab.toLowerCase();
  return (RECRUITING_TABS as readonly string[]).includes(normalized)
    ? (normalized as RecruitingTab)
    : "positions";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default async function ChapterRecruitingPage(
  props: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
  }
) {
  const searchParams = await props.searchParams;
  const tabQuery = Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab;
  const activeTab = resolveRecruitingTab(tabQuery);

  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      chapterId: true,
      primaryRole: true,
      chapter: { select: { id: true, name: true } },
      roles: { select: { role: true } },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const roles = normalizeRoleList(user.roles, user.primaryRole);
  const canAccess = roles.includes("CHAPTER_PRESIDENT") || roles.includes("ADMIN");

  if (!canAccess) {
    redirect("/");
  }

  if (!user.chapterId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <PageHeaderV2 eyebrow="Chapter" title="Recruiting" backHref="/chapter" backLabel="Chapter Home" />
        <CardV2 padding="lg" className="mt-8 text-center">
          <p className="text-[13px] text-ink-muted">No chapter assignment found for your account.</p>
        </CardV2>
      </div>
    );
  }

  const chapterId = user.chapterId;

  if (tabQuery?.toLowerCase() === "interviews") {
    redirect(`/interviews/schedule?domain=HIRING&chapter=${chapterId}`);
  }

  const [positions, applications, interviewQueue] = await Promise.all([
    prisma.position.findMany({
      where: { chapterId },
      include: {
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.findMany({
      where: {
        position: { chapterId },
      },
      include: {
        applicant: {
          select: { id: true, name: true, email: true },
        },
        position: {
          select: {
            id: true,
            title: true,
            type: true,
            interviewRequired: true,
          },
        },
        interviewSlots: {
          orderBy: { scheduledAt: "asc" },
        },
        interviewNotes: {
          orderBy: { createdAt: "desc" },
        },
        decision: {
          select: { accepted: true, decidedAt: true },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.interviewSlot.findMany({
      where: {
        application: { position: { chapterId } },
        status: { in: ["POSTED", "CONFIRMED"] },
      },
      include: {
        application: {
          include: {
            applicant: {
              select: { name: true, email: true },
            },
            position: {
              select: { title: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const statusCount = {
    submitted: applications.filter((app) => app.status === "SUBMITTED").length,
    inReview: applications.filter((app) => app.status === "UNDER_REVIEW").length,
    interviewing: applications.filter((app) => app.status === "INTERVIEW_SCHEDULED").length,
    interviewComplete: applications.filter((app) => app.status === "INTERVIEW_COMPLETED").length,
    accepted: applications.filter((app) => app.status === "ACCEPTED").length,
    rejected: applications.filter((app) => app.status === "REJECTED").length,
  };

  const decisionQueue = applications.filter(
    (app) =>
      !app.decision &&
      app.status !== "WITHDRAWN" &&
      (app.status === "INTERVIEW_COMPLETED" || !app.position.interviewRequired)
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeaderV2
          eyebrow="Chapter"
          title="Recruiting"
          subtitle={user.chapter?.name}
          backHref="/chapter"
          backLabel="Chapter Home"
        />
        <ButtonLink href="/chapter/recruiting/positions/new" variant="primary" size="sm">
          New Position
        </ButtonLink>
      </div>

      <div className="mt-6 flex gap-2">
        {RECRUITING_TABS.map((tab) => {
          const active = activeTab === tab;
          return (
            <Link
              key={tab}
              href={`/chapter/recruiting?tab=${tab}`}
              className={`rounded-[9px] px-3 py-1.5 text-[13px] font-semibold ${
                active ? "bg-brand-600 text-white" : "border border-line text-ink"
              }`}
            >
              {TAB_LABELS[tab]}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CardV2 padding="md">
          <p className="text-[22px] font-bold text-ink">
            {positions.filter((position) => position.isOpen).length}
          </p>
          <p className="text-[12px] text-ink-muted">Open Positions</p>
        </CardV2>
        <CardV2 padding="md">
          <p className="text-[22px] font-bold text-ink">{statusCount.submitted + statusCount.inReview}</p>
          <p className="text-[12px] text-ink-muted">New Candidates</p>
        </CardV2>
        <CardV2 padding="md">
          <p className="text-[22px] font-bold text-ink">{interviewQueue.length}</p>
          <p className="text-[12px] text-ink-muted">Scheduled Interviews</p>
        </CardV2>
        <CardV2 padding="md">
          <p className="text-[22px] font-bold text-ink">{decisionQueue.length}</p>
          <p className="text-[12px] text-ink-muted">Awaiting Decision</p>
        </CardV2>
      </div>

      {activeTab === "positions" ? (
        <CardV2 padding="lg" className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">Positions</h2>
          {positions.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">No chapter positions yet.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {positions.map((position) => (
                <div key={position.id} className="rounded-[10px] border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{position.title}</p>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {position.type.replace(/_/g, " ")} · {position.visibility.replace(/_/g, " ")} ·{" "}
                        {position.interviewRequired ? "Interview required" : "Interview optional"}
                      </p>
                      <p className="mt-1 text-[12px] text-ink-muted">
                        Deadline: {formatDate(position.applicationDeadline)} · Start:{" "}
                        {formatDate(position.targetStartDate)} · Applications: {position._count.applications}
                      </p>
                    </div>
                    <span
                      className={`rounded-[6px] px-2 py-0.5 text-[11px] font-semibold ${
                        position.isOpen ? "bg-green-50 text-green-700" : "bg-line text-ink-muted"
                      }`}
                    >
                      {position.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <ButtonLink
                      href={`/chapter/recruiting/positions/${position.id}/edit`}
                      variant="secondary"
                      size="sm"
                    >
                      Edit
                    </ButtonLink>
                    {position.isOpen ? (
                      <form action={closeChapterPosition}>
                        <input type="hidden" name="positionId" value={position.id} />
                        <button
                          type="submit"
                          className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
                        >
                          Close
                        </button>
                      </form>
                    ) : (
                      <form action={reopenChapterPosition}>
                        <input type="hidden" name="positionId" value={position.id} />
                        <button
                          type="submit"
                          className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
                        >
                          Reopen
                        </button>
                      </form>
                    )}
                    <form action={updatePositionVisibility} className="flex items-center gap-2">
                      <input type="hidden" name="positionId" value={position.id} />
                      <select
                        name="visibility"
                        defaultValue={position.visibility}
                        className="rounded-[9px] border border-line px-2 py-1.5 text-[13px]"
                      >
                        <option value="CHAPTER_ONLY">Chapter Only</option>
                        <option value="NETWORK_WIDE">Network Wide</option>
                        <option value="PUBLIC">Public</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-[9px] border border-line px-3 py-1.5 text-[13px] font-semibold text-ink"
                      >
                        Update Visibility
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardV2>
      ) : null}

      {activeTab === "candidates" ? (
        <CardV2 padding="lg" className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">Candidates</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">
            Submitted: {statusCount.submitted} · In Review: {statusCount.inReview} · Interviewing:{" "}
            {statusCount.interviewing} · Interview Complete: {statusCount.interviewComplete} · Accepted:{" "}
            {statusCount.accepted} · Rejected: {statusCount.rejected}
          </p>

          {applications.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">No applications yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[12px] text-ink-muted">
                    <th className="py-2 pr-3 font-semibold">Candidate</th>
                    <th className="py-2 pr-3 font-semibold">Position</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Submitted</th>
                    <th className="py-2 pr-3 font-semibold">Interview</th>
                    <th className="py-2 pr-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const nextSlot = app.interviewSlots.find(
                      (slot) => slot.status === "POSTED" || slot.status === "CONFIRMED"
                    );
                    const hasRecommendation = app.interviewNotes.some((note) => note.recommendation !== null);
                    return (
                      <tr key={app.id} className="border-b border-line">
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-ink">{app.applicant.name}</div>
                          <div className="text-[12px] text-ink-muted">{app.applicant.email}</div>
                        </td>
                        <td className="py-2 pr-3">{app.position.title}</td>
                        <td className="py-2 pr-3">{app.status.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-3">{new Date(app.submittedAt).toLocaleDateString()}</td>
                        <td className="py-2 pr-3">
                          {nextSlot ? formatDate(nextSlot.scheduledAt) : "Not scheduled"}
                          {hasRecommendation ? (
                            <div className="text-[11px] text-green-700">Has recommendation</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <Link href={`/applications/${app.id}`} className="text-brand-700 underline">
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardV2>
      ) : null}

      {activeTab === "decisions" ? (
        <CardV2 padding="lg" className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">Decisions</h2>
          {decisionQueue.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-muted">No candidates are ready for a decision.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              {decisionQueue.map((app) => {
                const hasRecommendation = app.interviewNotes.some((note) => note.recommendation !== null);
                const hasCompletedSlot = app.interviewSlots.some((slot) => slot.status === "COMPLETED");
                const decisionReady = !app.position.interviewRequired || (hasRecommendation && hasCompletedSlot);

                return (
                  <div key={app.id} className="rounded-[10px] border border-line p-3">
                    <p className="text-[14px] font-semibold text-ink">
                      {app.applicant.name} · {app.position.title}
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-muted">
                      Interview done: {hasCompletedSlot ? "Yes" : "No"} · Recommendation:{" "}
                      {hasRecommendation ? "Yes" : "No"}
                    </p>
                    {!decisionReady ? (
                      <p className="mt-1.5 text-[12px] text-amber-700">
                        Complete the interview and add a recommendation note before deciding.
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/applications/${app.id}`} className="text-[13px] text-brand-700 underline">
                        Open Workspace
                      </Link>
                    </div>

                    <form action={chapterMakeDecision} className="mt-3 grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <select
                        name="accepted"
                        defaultValue="true"
                        className="rounded-[9px] border border-line px-2 py-1.5 text-[13px]"
                      >
                        <option value="true">Accept</option>
                        <option value="false">Reject</option>
                      </select>
                      <input
                        name="notes"
                        placeholder="Optional notes"
                        className="rounded-[9px] border border-line px-3 py-1.5 text-[13px]"
                      />
                      <button
                        type="submit"
                        disabled={!decisionReady}
                        className="rounded-[9px] border border-transparent bg-[linear-gradient(135deg,#5a1da8_0%,#6b21c8_52%,#8b3fe8_100%)] px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50 sm:col-span-2"
                      >
                        Submit Decision
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </CardV2>
      ) : null}
    </div>
  );
}