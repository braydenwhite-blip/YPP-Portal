import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getLeadershipContext } from "@/lib/leadership-context";
import { CardV2 } from "@/components/ui-v2";
import { MenteeHomeRevamped } from "./_components/mentee-home-revamped";

export const metadata = {
  title: "My Mentor — YPP",
};

export default async function MyMentorPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getLeadershipContext(session.user.id);
  if (!ctx) redirect("/");

  const hasMentor = !!ctx.primaryMentor;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship</p>
          <h1 className="page-title" style={{ fontFamily: "var(--font-dm-sans), system-ui, -apple-system, sans-serif" }}>My Mentor</h1>
          {ctx.stageId ? (
            <p className="page-subtitle">
              {ctx.stageId}
              {ctx.nextStageId && (
                <>
                  <span aria-hidden style={{ color: "var(--muted)", margin: "0 8px" }}>→</span>
                  <span style={{ color: "var(--muted)" }}>{ctx.nextStageId}</span>
                </>
              )}
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/leadership-pathway" className="button secondary small">
            Pathway →
          </a>
          <a href="/mentorship" className="button small" style={{ background: "var(--ypp-purple-600)", color: "white" }}>
            {(ctx.mentees?.length ?? 0) > 0 ? `My Mentees (${ctx.mentees.length ?? 0})` : "Mentorship Workspace →"}
          </a>
        </div>
      </div>

      {(ctx.mentees?.length ?? 0) > 0 && (
        <CardV2 padding="md" className="border-l-4 border-l-brand-600">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="m-0 mb-2 text-[16px] font-bold text-ink">Write Monthly Reviews</h3>
              <p className="m-0 mb-3 text-[13px] text-ink-muted">
                After your mentees submit their monthly reflections, you'll write reviews here. Reviews are submitted to a chair for approval before being shared.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="/mentorship/reviews" className="button primary small">
                  Open Review Inbox
                </a>
                <a href="/mentorship" className="button secondary small">
                  Go to Mentorship Dashboard
                </a>
              </div>
            </div>
          </div>
        </CardV2>
      )}
      <MenteeHomeRevamped
        mentorName={ctx.primaryMentor?.name ?? ""}
        kickoffCompleted={!!ctx.primaryMentor?.kickoffCompletedAt}
        hasMentor={hasMentor}
      />
    </div>
  );
}