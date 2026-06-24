"use client";

import Link from "next/link";
import { useState } from "react";
import { ButtonLink, CardV2, StatCardV2 } from "@/components/ui-v2";
import { cn } from "@/components/ui-v2/cn";

interface MenteeHomeRevampedProps {
  mentorName: string;
  kickoffCompleted: boolean;
  hasMentor: boolean;
}

const TABS = [
  { key: "goals", label: "Goals & Resources" },
  { key: "progress", label: "Progress" },
  { key: "check-ins", label: "Check-ins" },
  { key: "feedback", label: "Feedback" },
  { key: "resources", label: "Resources" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export function MenteeHomeRevamped({
  mentorName,
  kickoffCompleted,
  hasMentor,
}: MenteeHomeRevampedProps) {
  const [activeTab, setActiveTab] = useState<Tab>("goals");

  if (!hasMentor) {
    return <NotMatchedPanel />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <CardV2 padding="lg" className="border border-line-soft bg-gradient-to-br from-brand-50 to-purple-50">
        <div className="flex items-start gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="m-0 text-[20px] font-bold text-ink">Hey, Alex!</h2>
            <p className="m-0 mt-1 text-[14px] text-ink-muted">
              {kickoffCompleted
                ? `You're making great progress with ${mentorName}. Keep up the momentum!`
                : `Your kickoff with ${mentorName} is being set up. Come ready with your goals!`}
            </p>
          </div>
        </div>
      </CardV2>

      {/* Stat Cards Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCardV2
          label="Active Goals"
          value={3}
          detail="2 in progress"
          href="/my-mentor/goals"
          accent="brand"
        />
        <StatCardV2
          label="Check-ins"
          value={2}
          detail="This month"
          href="/my-mentor/schedule"
          accent="teal"
        />
        <StatCardV2
          label="Resources"
          value={5}
          detail="Available to you"
          href="/my-mentor/resources"
          accent="success"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Tabbed Content */}
        <div className="flex flex-col gap-5">
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                  activeTab === tab.key
                    ? "bg-brand-600 text-white"
                    : "bg-surface border border-line-soft text-ink-muted hover:border-brand-400 hover:text-ink"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "goals" && <MenteeGoalsTab />}
          {activeTab === "progress" && <MenteeProgressTab />}
          {activeTab === "check-ins" && <MenteeCheckInsTab />}
          {activeTab === "feedback" && <MenteeFeedbackTab mentorName={mentorName} />}
          {activeTab === "resources" && <MenteeResourcesTab />}
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Mentor Info Card */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">Your Mentor</h3>
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-[14px] font-bold text-brand-700">
                {mentorName.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <p className="m-0 text-[14px] font-semibold text-ink">{mentorName}</p>
                <p className="m-0 text-[12px] text-ink-muted">Your dedicated mentor</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <ButtonLink href={`/mentorship/mentees`} variant="secondary" size="sm" className="w-full">
                View mentorship details
              </ButtonLink>
              <ButtonLink href="/my-mentor/schedule" variant="secondary" size="sm" className="w-full">
                Schedule a session
              </ButtonLink>
            </div>
          </CardV2>

          {/* Quick Actions */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              <ButtonLink href="/my-mentor/reflection" variant="primary" size="sm" className="w-full">
                Log a reflection
              </ButtonLink>
              <ButtonLink href="/my-mentor/goals" variant="secondary" size="sm" className="w-full">
                Update my goals
              </ButtonLink>
              <ButtonLink href="/my-mentor/ask" variant="secondary" size="sm" className="w-full">
                Ask a question
              </ButtonLink>
            </div>
          </CardV2>

          {/* Upcoming Sessions */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">Upcoming Sessions</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-lg border border-line-soft bg-surface-muted p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="m-0 text-[13px] font-semibold text-ink">Monthly Check-in</p>
                  <p className="m-0 text-[12px] text-ink-muted">Jun 12, 2:00 PM · 30 min</p>
                </div>
              </div>
            </div>
            <Link href="/my-mentor/schedule" className="mt-3 block text-right text-[12px] font-semibold text-brand-700 hover:text-brand-800">
              View calendar →
            </Link>
          </CardV2>
        </div>
      </div>

      {/* Bottom Banner */}
      <CardV2 padding="lg" className="border border-line-soft bg-gradient-to-r from-brand-50 to-purple-50">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
            </svg>
          </div>
          <div>
            <h3 className="m-0 text-[16px] font-bold text-ink">Your growth journey continues.</h3>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">Keep reflecting, keep growing. Your mentor is here to support you.</p>
          </div>
        </div>
      </CardV2>
    </div>
  );
}

function NotMatchedPanel() {
  return (
    <div className="flex flex-col gap-6" style={{ fontFamily: "var(--font-dm-sans), system-ui, -apple-system, sans-serif" }}>
      <CardV2 padding="lg" className="border border-line-soft bg-surface">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-4">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>
           <h2 className="m-0 text-[20px] font-bold text-ink">You're not yet paired with a mentor.</h2>
          <p className="m-0 mt-2 text-[14px] text-ink-muted max-w-md">
            Reach out to chapter leadership to get matched. Until then, the leadership pathway shows how mentorship flows at YPP.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/my-mentor/apply" variant="primary" size="md">
              Apply for a mentor →
            </ButtonLink>
            <ButtonLink href="/leadership-pathway" variant="secondary" size="md">
              View leadership pathway
            </ButtonLink>
          </div>
        </div>
      </CardV2>

      {/* Resources while waiting */}
      <CardV2 padding="md" className="border border-line-soft bg-surface">
        <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">While You Wait</h3>
        <div className="flex flex-col gap-3">
          {[
            { label: "Explore the Leadership Pathway", desc: "Understand how mentorship fits into your growth journey", href: "/leadership-pathway" },
            { label: "Set Your Goals", desc: "Start thinking about what you want to achieve", href: "/my-mentor/goals" },
            { label: "Learn About Mentorship", desc: "Discover what to expect from a YPP mentor", href: "/mentorship/resources" },
          ].map((resource) => (
            <Link
              key={resource.label}
              href={resource.href}
              className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-muted"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[13px] font-semibold text-ink">{resource.label}</p>
                <p className="m-0 text-[11px] text-ink-muted">{resource.desc}</p>
              </div>
              <svg className="size-4 text-ink-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </CardV2>
    </div>
  );
}

function MenteeGoalsTab() {
  const goals = [
    { id: 1, title: "Improve public speaking", progress: 75, status: "In progress" },
    { id: 2, title: "Complete product certification", progress: 50, status: "In progress" },
    { id: 3, title: "Lead design sprint", progress: 60, status: "In progress" },
  ];

  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="m-0 text-[14px] font-bold text-ink">My Goals</h3>
        <ButtonLink href="/my-mentor/goals" variant="secondary" size="sm">
          Manage goals
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-3">
        {goals.map((goal) => (
          <div key={goal.id} className="flex items-center justify-between rounded-lg border border-line-soft p-4">
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] font-semibold text-ink">{goal.title}</p>
              <p className="m-0 mt-1 text-[12px] text-ink-muted">{goal.status}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 rounded-full bg-line-soft">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${goal.progress}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-ink-muted min-w-[40px] text-right">{goal.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </CardV2>
  );
}

function MenteeProgressTab() {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">My Progress</h3>
      <p className="m-0 text-[13px] text-ink-muted mb-4">Track your growth and achievements over time.</p>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="m-0 text-[13px] font-semibold text-ink">Overall Progress</p>
            <span className="text-[12px] font-semibold text-brand-600">On track</span>
          </div>
          <div className="h-2 w-full rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-brand-500" style={{ width: "65%" }} />
          </div>
          <p className="m-0 mt-2 text-[12px] text-ink-muted">You're making steady progress toward your goals.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
            <p className="m-0 text-[24px] font-bold text-ink">12</p>
            <p className="m-0 mt-1 text-[12px] text-ink-muted">Sessions completed</p>
          </div>
          <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
            <p className="m-0 text-[24px] font-bold text-ink">8</p>
            <p className="m-0 mt-1 text-[12px] text-ink-muted">Reflections submitted</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ButtonLink href="/my-program/achievement-journey" variant="secondary" size="sm">
          View full achievement journey →
        </ButtonLink>
      </div>
    </CardV2>
  );
}

function MenteeCheckInsTab() {
  const checkIns = [
    { id: 1, date: "Jun 12", time: "2:00 PM", duration: "30 min", type: "Monthly Check-in" },
    { id: 2, date: "Jun 15", time: "11:00 AM", duration: "30 min", type: "Monthly Check-in" },
  ];

  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="m-0 text-[14px] font-bold text-ink">My Check-ins</h3>
        <ButtonLink href="/my-mentor/schedule" variant="secondary" size="sm">
          Schedule new
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-3">
        {checkIns.map((checkIn) => (
          <div key={checkIn.id} className="flex items-center justify-between rounded-lg border border-line-soft bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <p className="m-0 text-[13px] font-semibold text-ink">{checkIn.type}</p>
                <p className="m-0 text-[12px] text-ink-muted">{checkIn.date} at {checkIn.time} · {checkIn.duration}</p>
              </div>
            </div>
            <ButtonLink href={`/my-mentor/schedule`} variant="secondary" size="sm">
              Prepare
            </ButtonLink>
          </div>
        ))}
      </div>
    </CardV2>
  );
}

function MenteeFeedbackTab({ mentorName }: { mentorName: string }) {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Feedback & Reviews</h3>
      <p className="m-0 text-[13px] text-ink-muted mb-4">View feedback from your mentor and track your growth.</p>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="m-0 text-[13px] font-semibold text-ink">Q2 2024 Review</p>
              <p className="m-0 text-[12px] text-ink-muted">From {mentorName}</p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">Completed</span>
          </div>
          <p className="m-0 text-[12px] text-ink-muted">Great progress on your communication skills. Keep focusing on leadership opportunities.</p>
        </div>

        <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="m-0 text-[13px] font-semibold text-ink">May 2024 Check-in</p>
              <p className="m-0 text-[12px] text-ink-muted">From {mentorName}</p>
            </div>
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">Completed</span>
          </div>
          <p className="m-0 text-[12px] text-ink-muted">Strong month. Your presentation skills are really developing.</p>
        </div>
      </div>

      <div className="mt-4">
        <ButtonLink href="/my-mentor/feedback" variant="secondary" size="sm">
          View all feedback →
        </ButtonLink>
      </div>
    </CardV2>
  );
}

function MenteeResourcesTab() {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Resources for Me</h3>
      <div className="flex flex-col gap-2">
        {[
          { label: "Goal Setting Guide", desc: "Learn how to set effective goals", href: "/my-mentor/resources" },
          { label: "Reflection Templates", desc: "Structured ways to reflect on your growth", href: "/my-mentor/resources" },
          { label: "Leadership Pathway", desc: "Map out your leadership journey", href: "/leadership-pathway" },
          { label: "Achievement Journey", desc: "Track your accomplishments", href: "/my-program/achievement-journey" },
        ].map((resource) => (
          <Link
            key={resource.label}
            href={resource.href}
            className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-muted"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] font-semibold text-ink">{resource.label}</p>
              <p className="m-0 text-[11px] text-ink-muted">{resource.desc}</p>
            </div>
            <svg className="size-4 text-ink-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </CardV2>
  );
}