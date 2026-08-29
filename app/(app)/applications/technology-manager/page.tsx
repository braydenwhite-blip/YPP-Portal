import Link from "next/link";
import { redirect } from "next/navigation";

import TechnologyManagerApplicationForm from "@/components/technology-manager-application-form";
import { getSession } from "@/lib/auth-supabase";
import { ensureTechnologyManagerPosition } from "@/lib/application-actions";
import { prisma } from "@/lib/prisma";
import {
  TECHNOLOGY_MANAGER_POSITION_DESCRIPTION,
  TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS,
} from "@/lib/technology-manager-application";

export default async function TechnologyManagerApplyPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login?next=/applications/technology-manager");
  }

  const position = await ensureTechnologyManagerPosition();
  const deadlinePassed = Boolean(
    position.applicationDeadline && position.applicationDeadline < new Date()
  );
  const isOpen = position.isOpen && !deadlinePassed;

  const existingApplication = await prisma.application.findFirst({
    where: {
      positionId: position.id,
      applicantId: session.user.id,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <Link href="/positions" style={{ color: "var(--muted)", fontSize: 13 }}>
            &larr; Back to Positions
          </Link>
          <h1 className="page-title">Technology Manager</h1>
          <p className="page-subtitle">
            Apply to join YPP&apos;s tech team — improve portal tools, support chapters, and help
            ship reliable internal systems.
          </p>
        </div>
        <span className={`pill ${isOpen ? "pill-success" : "pill-declined"}`}>
          {isOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>

      <div className="grid two">
        <div>
          <div className="card">
            <div className="section-title">About the role</div>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {TECHNOLOGY_MANAGER_POSITION_DESCRIPTION}
            </p>
            <div className="section-title" style={{ marginTop: 24 }}>
              Requirements
            </div>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {TECHNOLOGY_MANAGER_POSITION_REQUIREMENTS}
            </p>
          </div>
        </div>

        <div>
          <div className="card">
            {existingApplication ? (
              <div>
                <div className="section-title">Your Application</div>
                <div
                  style={{
                    padding: 20,
                    background: "var(--surface-alt)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                  }}
                >
                  <p style={{ marginBottom: 12 }}>You have already applied for this role.</p>
                  <span className="pill">
                    Status: {existingApplication.status.replace(/_/g, " ")}
                  </span>
                  <div style={{ marginTop: 16 }}>
                    <Link href={`/applications/${existingApplication.id}`} className="link">
                      View your application &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            ) : !isOpen ? (
              <div>
                <div className="section-title">Applications Closed</div>
                <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                  {deadlinePassed
                    ? "This opening is no longer accepting applications because the deadline has passed."
                    : "This opening is currently closed by the hiring team."}
                </p>
              </div>
            ) : (
              <>
                <div className="section-title">Apply now</div>
                <TechnologyManagerApplicationForm />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
