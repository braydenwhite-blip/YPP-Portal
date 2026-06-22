import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { hasAnyRole, OFFICER_TIER_ROLES } from "@/lib/authorization";
import { isMentorship2Enabled } from "@/lib/feature-flags";
import {
  MENTORSHIP_APPLICATION_STATUS_LABELS,
  isOpenApplicationStatus,
  type MentorshipApplicationStatus,
} from "@/lib/mentorship-2/constants";
import { listRecommendationsForApplication } from "@/lib/mentorship-2/recommendations/queries";
import { buildApplicationInput } from "@/lib/mentorship-2/recommendations/inputs";
import {
  explainRecommendationFromContext,
  type ExplainContext,
} from "@/lib/mentorship-2/matching/explain";
import { RECOMMENDATION_MIN_USEFUL_SCORE } from "@/lib/mentorship-2/matching/rank";
import {
  MatchingRecommendations,
  type RecommendationCard,
} from "@/components/mentorship-2/matching-recommendations";
import { ApplicationDecision } from "@/components/mentorship-2/application-decision";
import { ApplicationMatchCalm } from "@/components/mentorship-2/application-match-calm";
import { CalmCollapse, CalmOnly } from "@/components/command-center/command-mode";

export const metadata = { title: "Application — Mentorship matching — YPP" };

export default async function MentorshipApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isMentorship2Enabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  if (
    !hasAnyRole(
      session.user.roles ?? [],
      [...OFFICER_TIER_ROLES],
      session.user.primaryRole ?? null
    )
  ) {
    redirect("/");
  }

  const { id } = await params;

  const application = await prisma.mentorshipApplication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      goals: true,
      interests: true,
      preferredExpertise: true,
      availability: true,
      motivation: true,
      createdAt: true,
      reviewNotes: true,
      applicant: {
        select: {
          name: true,
          email: true,
          profile: {
            select: { careerGoal: true, leadershipGoal: true, grade: true },
          },
        },
      },
    },
  });
  if (!application) notFound();

  const status = application.status as MentorshipApplicationStatus;
  const applicationOpen = isOpenApplicationStatus(status);

  const [recs, taxonomy] = await Promise.all([
    listRecommendationsForApplication(id),
    prisma.expertiseArea.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
    }),
  ]);

  const input = buildApplicationInput(application, taxonomy);
  const requested = new Set(input.requestedExpertiseSlugs);

  const cards: RecommendationCard[] = recs.map((r) => {
    const matched = r.mentorExpertise
      .filter((e) => requested.has(e.slug))
      .map((e) => ({ slug: e.slug, name: e.name }));
    const ctx: ExplainContext = {
      score: r.score,
      breakdown: r.breakdown,
      matchedExpertise: matched,
      openSlots:
        r.mentorCapacity != null ? Math.max(0, r.mentorCapacity - r.mentorLoad) : 0,
      activeLoad: r.mentorLoad,
      capacity: r.mentorCapacity,
      expertiseCount: r.mentorExpertise.length,
      hasAvailability: r.mentorHasAvailability,
      mentorName: r.mentorName,
    };
    const ex = explainRecommendationFromContext(ctx);
    return {
      id: r.id,
      status: r.status,
      score: r.score,
      mentorName: r.mentorName,
      mentorEmail: r.mentorEmail,
      mentorExpertise: r.mentorExpertise,
      mentorCapacity: r.mentorCapacity,
      mentorLoad: r.mentorLoad,
      adminNote: r.adminNote,
      explanation: ex.prose,
      strengths: ex.strengths,
      risks: ex.risks,
    };
  });

  const usableMatch = cards.some((c) => c.score >= RECOMMENDATION_MIN_USEFUL_SCORE);
  const profile = application.applicant?.profile;

  // The single highest-scoring live candidate — the one Calm leads the decision
  // with. Closed (rejected/superseded) recommendations are never "the next
  // move", so they're excluded.
  const topRecommendation =
    cards
      .filter((c) => c.status !== "REJECTED" && c.status !== "SUPERSEDED")
      .sort((a, b) => b.score - a.score)[0] ?? null;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship matching</p>
          <h1 className="page-title">
            {application.applicant?.name ?? application.applicant?.email}
          </h1>
          <p className="page-subtitle">
            {application.applicant?.email} · applied{" "}
            {application.createdAt.toLocaleDateString()} ·{" "}
            {MENTORSHIP_APPLICATION_STATUS_LABELS[status]}
          </p>
        </div>
        <Link href="/admin/mentorship/applications" className="button secondary small">
          ← All applications
        </Link>
      </div>

      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 860 }}>
        <section className="card" style={{ display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>What the mentee submitted</h2>
          {application.goals ? (
            <Field label="Goals" value={application.goals} />
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>No goals provided.</p>
          )}
          {application.interests.length > 0 && (
            <Field label="Interests" value={application.interests.join(", ")} />
          )}
          {application.preferredExpertise.length > 0 && (
            <Field
              label="Seeking expertise"
              value={application.preferredExpertise.join(", ")}
            />
          )}
          {application.availability && (
            <Field label="Availability" value={application.availability} />
          )}
          {application.motivation && (
            <Field label="Motivation" value={application.motivation} />
          )}
          {(profile?.careerGoal || profile?.leadershipGoal) && (
            <div style={{ display: "grid", gap: 6, marginTop: 4 }}>
              {profile?.careerGoal && <Field label="Career goal" value={profile.careerGoal} />}
              {profile?.leadershipGoal && (
                <Field label="Leadership goal" value={profile.leadershipGoal} />
              )}
            </div>
          )}
          {application.reviewNotes && (
            <Field label="Review notes" value={application.reviewNotes} />
          )}
        </section>

        <CalmOnly>
          <ApplicationMatchCalm
            applicationId={id}
            top={topRecommendation}
            applicationOpen={applicationOpen}
            usableMatch={usableMatch}
          />
        </CalmOnly>

        <CalmCollapse label="Full scored board" hint="shortlist, hold, reject & the rest of the pool">
          <MatchingRecommendations
            applicationId={id}
            recommendations={cards}
            applicationOpen={applicationOpen}
            usableMatch={usableMatch}
            showEmail
          />
        </CalmCollapse>

        {applicationOpen && (
          <ApplicationDecision applicationId={id} status={status} />
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 600 }}>{label}:</span> {value}
    </p>
  );
}
