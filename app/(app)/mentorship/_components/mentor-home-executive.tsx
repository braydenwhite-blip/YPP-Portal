import Link from "next/link";

import type { getSimplifiedMentorKanban } from "@/lib/mentorship-kanban-actions";
import type { getMentorEngagementSnapshot } from "@/lib/mentor-overview";

import {
  MentorCommandStrip,
  MentorEngagementPanels,
} from "./mentor-command-center";
import { MentorPriorityList } from "./mentor-priority-list";

/**
 * Executive mentor home — the full operating cockpit, preserved verbatim from
 * the original `/mentorship` surface: the four-tile command strip, the workspace
 * link grid, the most-urgent alert, the prioritized mentee list, and the
 * forward-looking engagement panels. Calm mode supersedes this with a single
 * focus + a short list; nothing here is removed, only gated behind the mode.
 */
export function MentorHomeExecutive({
  urgentAlert,
  mentorBlock,
  engagement,
  activeMenteeCount,
  needsYouCount,
  showChairQueue,
}: {
  urgentAlert: { tone: "blue" | "amber"; title: string; detail: string } | null;
  mentorBlock: Awaited<ReturnType<typeof getSimplifiedMentorKanban>>;
  engagement: Awaited<ReturnType<typeof getMentorEngagementSnapshot>> | null;
  activeMenteeCount: number;
  needsYouCount: number;
  showChairQueue: boolean;
}) {
  const alertColors =
    urgentAlert?.tone === "amber"
      ? { border: "#f59e0b", bg: "#fffbeb", text: "#92400e" }
      : { border: "#3b82f6", bg: "#eff6ff", text: "#1e40af" };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <MentorCommandStrip
        activeMentees={activeMenteeCount}
        needsYou={needsYouCount}
        upcomingSessionCount={engagement?.upcomingSessionCount ?? 0}
        nextSessionAt={engagement?.nextSessionAt ?? null}
        quietCount={engagement?.quietMentees.length ?? 0}
      />

      <MentorWorkspaceLinks showChairQueue={showChairQueue} />

      {urgentAlert && (
        <div
          style={{
            padding: "14px 18px",
            background: alertColors.bg,
            borderLeft: `4px solid ${alertColors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
          role="status"
        >
          <div>
            <strong style={{ color: alertColors.text }}>{urgentAlert.title}</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: alertColors.text, opacity: 0.85 }}>
              {urgentAlert.detail}
            </p>
          </div>
        </div>
      )}

      <MentorPriorityList
        columns={mentorBlock.columns}
        inactive={mentorBlock.inactive}
        total={mentorBlock.total}
      />

      {engagement && (
        <MentorEngagementPanels
          upcomingSessions={engagement.upcomingSessions}
          quietMentees={engagement.quietMentees}
        />
      )}
    </div>
  );
}

function MentorWorkspaceLinks({ showChairQueue }: { showChairQueue: boolean }) {
  const links = [
    { href: "/mentorship/mentees", label: "My Mentees" },
    { href: "/mentorship/reviews", label: "Monthly Reviews" },
    { href: "/mentorship/schedule", label: "Schedule" },
    { href: "/mentorship/resources", label: "Resources" },
    { href: "/mentorship/ask", label: "Ask / Flag" },
    { href: "/mentorship/feedback", label: "Feedback" },
    { href: "/mentorship/awards", label: "Awards" },
    { href: "/mentor/incubator", label: "Project Mentoring" },
    ...(showChairQueue ? [{ href: "/mentorship/chair", label: "Chair Queue" }] : []),
  ];

  return (
    <nav
      aria-label="Mentor workspace sections"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 10,
      }}
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          style={{
            padding: "10px 12px",
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            textDecoration: "none",
            fontWeight: 650,
            fontSize: 13,
          }}
        >
          {link.label} →
        </Link>
      ))}
    </nav>
  );
}
