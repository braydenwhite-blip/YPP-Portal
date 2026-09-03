import {
  calendarMonthLabel,
  currentCalendarMonth,
  lifecycleMonthFromCalendar,
} from "@/components/chapter/metrics-tracker/chapter-month-nav";
import { EmptyStateV2 } from "@/components/ui-v2";
import { loadPersonAssignedMetrics } from "@/lib/chapters/metrics-tracker/load";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

import { PersonMetricsPanel } from "./person-metrics-panel";

/**
 * Mentorship Metrics tab — metrics assigned to this person by name.
 */
export async function PersonMetricsSection({
  workspace,
}: {
  workspace: MentorshipWorkspace;
}) {
  const role = workspace.person.primaryRole;
  const isInstructorTrack =
    role === "INSTRUCTOR" ||
    role === "CHAPTER_PRESIDENT" ||
    role === "MENTOR" ||
    role === "STAFF" ||
    role === "ADMIN";

  const calendarMonth = currentCalendarMonth();
  const chapterMonth = lifecycleMonthFromCalendar(calendarMonth);
  const { categories } = await loadPersonAssignedMetrics(workspace.person.id, {
    chapterMonth,
    personName: workspace.person.name,
    includeInstructorTemplate: isInstructorTrack,
  });

  if (categories.length === 0) {
    return (
      <EmptyStateV2
        title="No metrics yet"
        body={
          workspace.isSelf
            ? "Metrics show up here once an org action item or instructor target is assigned to you."
            : workspace.person.name.trim()
              ? `No metrics are assigned to ${workspace.person.name.trim()} yet.`
              : "No metrics are assigned to this person yet."
        }
      />
    );
  }

  return (
    <PersonMetricsPanel
      personName={workspace.person.name}
      isSelf={workspace.isSelf}
      monthLabel={calendarMonthLabel(calendarMonth)}
      categories={categories}
    />
  );
}
