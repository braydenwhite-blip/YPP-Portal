import {
  calendarMonthLabel,
  currentCalendarMonth,
  lifecycleMonthFromCalendar,
} from "@/components/chapter/metrics-tracker/chapter-month-nav";
import { EmptyStateV2 } from "@/components/ui-v2";
import { loadPersonInstructorMetrics } from "@/lib/chapters/metrics-tracker/load";
import type { MentorshipWorkspace } from "@/lib/mentorship/workspace";

import { PersonMetricsPanel } from "./person-metrics-panel";

/**
 * Mentorship Metrics tab — instructor tracker metrics for this person.
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

  if (!isInstructorTrack) {
    return (
      <EmptyStateV2
        title="No metrics yet"
        body={
          workspace.isSelf
            ? "Metrics show up here once you’re on an instructor track."
            : "This person doesn’t have instructor metrics yet."
        }
      />
    );
  }

  const calendarMonth = currentCalendarMonth();
  const chapterMonth = lifecycleMonthFromCalendar(calendarMonth);
  const snapshot = await loadPersonInstructorMetrics(workspace.person.id, {
    chapterMonth,
    personName: workspace.person.name,
  });

  if (snapshot.categories.length === 0) {
    return (
      <EmptyStateV2
        title="No metrics yet"
        body="Instructor metrics haven’t been set up for this person."
      />
    );
  }

  return (
    <PersonMetricsPanel
      personName={workspace.person.name}
      isSelf={workspace.isSelf}
      monthLabel={calendarMonthLabel(calendarMonth)}
      categories={snapshot.categories}
    />
  );
}
