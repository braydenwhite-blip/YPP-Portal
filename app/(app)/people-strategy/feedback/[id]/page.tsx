import { notFound, redirect } from "next/navigation";

import { getSession } from "@/lib/auth-supabase";
import { isActionTrackerEmailsEnabled } from "@/lib/feature-flags";
import { getFeedbackRequestForCollaborator } from "@/lib/people-strategy/feedback-requests";
import { FeedbackResponseForm } from "./client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Share Feedback · People Strategy" };

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default async function FeedbackRequestPage({
  params,
}: {
  params: { id: string };
}) {
  // Feature flag is the outer gate — with the flag off the route doesn't exist.
  if (!isActionTrackerEmailsEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/login?next=/people-strategy/feedback/${params.id}`);
  }

  // Returns the request ONLY when the viewer is the named collaborator. Anyone
  // else (including the subject) gets a 404 — they can't read it here, and the
  // raw responses are CPO/Board-only via getFeedbackResponsesForSubject().
  const request = await getFeedbackRequestForCollaborator(params.id, session.user.id);
  if (!request) notFound();

  const subjectName = request.subjectUser.name ?? "your colleague";

  return (
    <div className="page-shell" style={{ maxWidth: 680 }}>
      <p className="badge">Confidential · People Strategy</p>
      <h1 className="page-title" style={{ marginTop: 8 }}>
        Feedback for {subjectName}
      </h1>
      <p className="page-subtitle">
        {monthLabel(request.month)} · Your response is read only by the Chief People
        Officer and Board. {subjectName} will not see what you write — please be
        candid and constructive.
      </p>

      <FeedbackResponseForm
        requestId={request.id}
        subjectName={subjectName}
        initialResponse={request.responseBody}
        initialSubmittedAt={request.submittedAt ? request.submittedAt.toISOString() : null}
      />
    </div>
  );
}
