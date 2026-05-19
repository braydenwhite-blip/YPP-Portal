import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getHiringDemoHomeHref,
  isHiringDemoModeEnabled,
} from "@/lib/hiring-demo-mode";
import { InstructorDashboard } from "@/components/instructor/instructor-dashboard";

// Roles that work the hiring pipeline and should land on the applicant board.
const REVIEWER_ROLES = ["ADMIN", "HIRING_CHAIR", "CHAPTER_PRESIDENT"];

function firstName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

function HomeShell({
  greeting,
  intro,
  children,
}: {
  greeting: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 540, margin: "72px auto 96px", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px" }}>{greeting}</h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.55, margin: "0 0 24px" }}>
        {intro}
      </p>
      {children}
    </div>
  );
}

function PrimaryCard({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="card"
      style={{ display: "block", padding: "22px 24px", textDecoration: "none", color: "inherit" }}
    >
      <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{title}</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--muted)", lineHeight: 1.5 }}>
        {body}
      </p>
      <span className="button small" style={{ pointerEvents: "none" }}>
        {cta}
      </span>
    </Link>
  );
}

function ReviewerHome({ name }: { name: string }) {
  return (
    <HomeShell
      greeting={name ? `Hi, ${name}.` : "Welcome back."}
      intro="The application board is the one page that's ready to use. The rest of the portal is still being tested."
    >
      <PrimaryCard
        href="/admin/instructor-applicants"
        title="Application board"
        body="Review instructor applicants and move them through the hiring pipeline."
        cta="Open the board"
      />
    </HomeShell>
  );
}

function ApplicantHome({ name }: { name: string }) {
  return (
    <HomeShell
      greeting={name ? `Hi, ${name}.` : "Welcome back."}
      intro="Check where your application stands below. The rest of the portal is still being tested."
    >
      <PrimaryCard
        href="/application-status"
        title="Your application"
        body="See your current status and respond to anything the team has asked for."
        cta="View status"
      />
      <p style={{ marginTop: 20, fontSize: 13, color: "var(--muted)" }}>
        Haven&apos;t applied yet?{" "}
        <Link href="/applications/summer-workshop" style={{ color: "#6b21c8", fontWeight: 600 }}>
          Start an application
        </Link>
        .
      </p>
    </HomeShell>
  );
}

export default async function OverviewPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (isHiringDemoModeEnabled()) {
    redirect(
      getHiringDemoHomeHref({
        primaryRole: session.user.primaryRole,
        roles: session.user.roles ?? [],
      })
    );
  }

  const roles = session.user.roles ?? [];
  const isReviewer = roles.some((role) => REVIEWER_ROLES.includes(role));
  const isInstructor =
    roles.includes("INSTRUCTOR") || session.user.primaryRole === "INSTRUCTOR";
  const name = firstName(session.user.name);

  if (isReviewer) {
    return <ReviewerHome name={name} />;
  }

  if (isInstructor) {
    return <InstructorDashboard userId={session.user.id} name={name} />;
  }

  return <ApplicantHome name={name} />;
}
