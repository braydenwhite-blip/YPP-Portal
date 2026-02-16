import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitChapterProposal } from "@/lib/application-actions";

const FINAL_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);

function statusClass(status: string) {
  if (status === "ACCEPTED") return "pill-success";
  if (status === "REJECTED" || status === "WITHDRAWN") return "pill-declined";
  if (status === "INTERVIEW_SCHEDULED" || status === "INTERVIEW_COMPLETED") return "pill-pathway";
  return "";
}

export default async function ProposeChapterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const proposals = await prisma.application.findMany({
    where: {
      applicantId: session.user.id,
      position: {
        type: "CHAPTER_PRESIDENT",
        chapterId: null,
      },
    },
    include: {
      decision: {
        select: {
          accepted: true,
          decidedAt: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const hasOpenProposal = proposals.some((proposal) => !FINAL_STATUSES.has(proposal.status));

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Chapter Growth</p>
          <h1 className="page-title">Propose a New Chapter</h1>
          <p className="page-subtitle">
            Submit your chapter concept and apply to be the founding chapter president.
          </p>
        </div>
        <Link href="/positions?type=CHAPTER_PRESIDENT" className="button small outline" style={{ textDecoration: "none" }}>
          View Chapter President Roles
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>How it works</h3>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Submit this chapter proposal with your launch plan.</li>
          <li>Admin reviews and schedules an interview.</li>
          <li>If accepted, your chapter is created and you are assigned as chapter president.</li>
        </ol>
      </div>

      {hasOpenProposal ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#b45309" }}>
            You already have a chapter proposal in progress. Submit a new one after it is finalized.
          </p>
        </div>
      ) : null}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Chapter Proposal Form</h3>
        <form action={submitChapterProposal} className="form-grid">
          <div className="grid two">
            <label className="form-row">
              Proposed Chapter Name
              <input className="input" name="chapterName" placeholder="YPP Austin" required />
            </label>
            <label className="form-row">
              Partner School / Organization (optional)
              <input className="input" name="partnerSchool" placeholder="Austin High School" />
            </label>
          </div>

          <div className="grid two">
            <label className="form-row">
              City
              <input className="input" name="city" placeholder="Austin" />
            </label>
            <label className="form-row">
              Region / State
              <input className="input" name="region" placeholder="TX" />
            </label>
          </div>

          <label className="form-row">
            Why this chapter should exist
            <textarea
              className="input"
              name="chapterVision"
              rows={4}
              placeholder="What local student need does this chapter solve?"
              required
            />
          </label>

          <label className="form-row">
            90-day launch plan
            <textarea
              className="input"
              name="launchPlan"
              rows={4}
              placeholder="First cohort plan, class pilots, milestones, and timeline."
              required
            />
          </label>

          <label className="form-row">
            Recruitment and operations plan
            <textarea
              className="input"
              name="recruitmentPlan"
              rows={4}
              placeholder="How you will recruit instructors/students and run chapter operations."
              required
            />
          </label>

          <label className="form-row">
            Why you should be chapter president
            <textarea
              className="input"
              name="leadershipBio"
              rows={4}
              placeholder="Leadership background, local relationships, and readiness to lead."
              required
            />
          </label>

          <label className="form-row">
            Resume URL (optional)
            <input type="url" className="input" name="resumeUrl" placeholder="https://..." />
          </label>

          <label className="form-row">
            Additional context (optional)
            <textarea
              className="input"
              name="additionalContext"
              rows={3}
              placeholder="Anything else reviewers should know."
            />
          </label>

          <button type="submit" className="button" disabled={hasOpenProposal}>
            Submit Chapter Proposal
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>My Chapter Proposals</h3>
        {proposals.length === 0 ? (
          <p className="empty">No chapter proposals submitted yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {proposals.map((proposal) => (
              <div key={proposal.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span className={`pill ${statusClass(proposal.status)}`}>{proposal.status.replace(/_/g, " ")}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    Submitted {new Date(proposal.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                {proposal.decision ? (
                  <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                    Decision: {proposal.decision.accepted ? "Accepted" : "Rejected"} on{" "}
                    {new Date(proposal.decision.decidedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--muted)" }}>
                    Review in progress.
                  </p>
                )}
                <Link href={`/applications/${proposal.id}`} className="link" style={{ marginTop: 8, display: "inline-block" }}>
                  Open Application Workspace
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
