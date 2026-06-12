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

function dueDateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export default async function FeedbackRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Feature flag is the outer gate — with the flag off the route doesn't exist.
  if (!isActionTrackerEmailsEnabled()) notFound();

  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/login?next=/people-strategy/feedback/${id}`);
  }

  // Returns the request ONLY when the viewer is the named collaborator. Anyone
  // else (including the subject) gets a 404 — they can't read it here, and the
  // raw responses are Leadership/Board-only via getFeedbackResponsesForSubject().
  const request = await getFeedbackRequestForCollaborator(id, session.user.id);
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
        {request.dueAt ? ` Please respond by ${dueDateLabel(request.dueAt)}.` : ""}
      </p>

      {request.reason || request.contextItems.length > 0 ? (
        <div className="card" style={{ padding: "14px 16px", marginBottom: 16, fontSize: 13 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Why you&apos;re being asked</p>
          {request.reason ? (
            <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>{request.reason}</p>
          ) : null}
          {request.contextItems.length > 0 ? (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--muted)" }}>
              {request.contextItems.map((item) => (
                <li key={`${item.type}-${item.id}-${item.title}`}>
                  {item.title}
                  {item.detail ? ` — ${item.detail}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "inherit" }}>
          Helpful prompts (3–5 minutes):
        </p>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          <li>What did {subjectName} do well this month?</li>
          <li>Where could they improve?</li>
          <li>Did they follow through on their responsibilities?</li>
          <li>Anything the Chief People Officer should know?</li>
        </ul>
      </div>

      <FeedbackResponseForm
        requestId={request.id}
        subjectName={subjectName}
        initialResponse={request.responseBody}
        initialSubmittedAt={request.submittedAt ? request.submittedAt.toISOString() : null}
      />
    </div>
  );
}
