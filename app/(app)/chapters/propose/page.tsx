import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChapterProposalForm from "@/components/chapter-proposal-form";

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
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { step: "1", text: "Submit this chapter proposal with your launch plan and leadership background." },
            { step: "2", text: "An admin reviews your proposal and schedules an interview to discuss your vision." },
            { step: "3", text: "If accepted, your chapter is created and you are assigned as chapter president." },
          ].map((item) => (
            <div
              key={item.step}
              style={{ display: "flex", gap: 12, alignItems: "center" }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#ede9fe",
                  color: "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {item.step}
              </div>
              <span style={{ fontSize: 14 }}>{item.text}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "14px 0 0" }}>
          The review process typically takes 7-14 days. You&#39;ll receive email updates at each stage.
        </p>
      </div>

      {hasOpenProposal ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: "#b45309" }}>
            You already have a chapter proposal in progress. Submit a new one after it is finalized.
          </p>
        </div>
      ) : null}

      <div className="card">
        <ChapterProposalForm disabled={hasOpenProposal} />
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
