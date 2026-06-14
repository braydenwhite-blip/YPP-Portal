import { redirect } from "next/navigation";

import {
  formatInstructorOpsDateTime,
  formatInstructorOpsLabel,
} from "@/lib/instructor-ops";
import { NotesEditor, TasksEditor } from "../../profile-editor";
import { SectionHeading } from "../_components/parts";
import { asArray, loadManageNotesData } from "../_components/loaders";

export const dynamic = "force-dynamic";

export default async function InstructorManageNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadManageNotesData(id);
  if (!data) redirect("/");

  const { profile, detail } = data;
  const { user } = profile;
  const instructorApplications = asArray(user.instructorApplications);
  const instructorGrowthEvents = asArray(user.instructorGrowthEvents);
  const applicationTimelineEvents = instructorApplications.flatMap((application: any) =>
    asArray(application.timeline).map((event: any) => ({
      ...event,
      applicationId: application.id,
    }))
  );
  const reviewActivity = instructorApplications.flatMap((application: any) => [
    ...asArray(application.applicationReviews).map((review: any, index: number) => ({
      id: `${application.id}-app-review-${index}`,
      title: "Application review",
      summary: review.summary ?? "No summary recorded.",
    })),
    ...asArray(application.interviewReviews).map((review: any, index: number) => ({
      id: `${application.id}-interview-review-${index}`,
      title: "Interview review",
      summary:
        review.recommendation || review.overallRating
          ? `${formatInstructorOpsLabel(review.recommendation ?? "Interview")}: ${
              review.overallRating ?? "No rating"
            }`
          : "No summary recorded.",
    })),
  ]);

  return (
    <section id="activity" className="card instructor-profile-section">
      <SectionHeading title="Notes & activity" detail="Admin notes, tasks, and timeline." />

      <div className="instructor-profile-activity-grid" style={{ marginBottom: 24 }}>
        <NotesEditor userId={id} initialNotes={detail.notes} />
        <TasksEditor userId={id} initialTasks={detail.tasks} />
      </div>

      <div className="instructor-profile-activity-grid">
        <div>
          <h3>Application activity</h3>
          <div className="instructor-profile-stack">
            {applicationTimelineEvents.length === 0 ? (
              <p className="instructor-profile-muted">No application timeline events found.</p>
            ) : (
              applicationTimelineEvents.map((event: any) => (
                <div key={event.id} className="instructor-profile-activity-row">
                  <strong>{formatInstructorOpsLabel(event.kind)}</strong>
                  <span>
                    {event.actor?.name ? `${event.actor.name} · ` : ""}
                    {formatInstructorOpsDateTime(event.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3>Review notes & growth</h3>
          <div className="instructor-profile-stack">
            {reviewActivity.map((activity: any) => (
              <div key={activity.id} className="instructor-profile-activity-row">
                <strong>{activity.title}</strong>
                <span>{activity.summary}</span>
              </div>
            ))}
            {instructorGrowthEvents.map((event: any) => (
              <div key={event.id} className="instructor-profile-activity-row">
                <strong>{event.title}</strong>
                <span>
                  {formatInstructorOpsLabel(event.status)} · {event.xpAmount} XP ·{" "}
                  {formatInstructorOpsDateTime(event.occurredAt)}
                </span>
              </div>
            ))}
            {reviewActivity.length === 0 && instructorGrowthEvents.length === 0 ? (
              <p className="instructor-profile-muted">No review notes or growth events found.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
