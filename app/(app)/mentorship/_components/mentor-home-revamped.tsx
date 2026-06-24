"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink, CardV2, PageHeaderV2, StatCardV2, StatusBadge } from "@/components/ui-v2";
import { cn } from "@/components/ui-v2/cn";

interface MentorHomeRevampedProps {
  menteeCount: number;
  activeMenteeCount: number;
  pendingReview: number;
  needsKickoff: number;
  needsYouCount: number;
  isAdmin: boolean;
  reviews?: Array<{ menteeId: string; menteeName: string; team: string; type: string; period: string; dueDate: string; status: string; statusTone: "danger" | "warning" | "default" }>;
}

const TABS = [
  { key: "reviews", label: "Reviews" },
  { key: "check-ins", label: "Check-ins" },
  { key: "follow-ups", label: "Follow-ups" },
  { key: "goals", label: "Goals & Progress" },
  { key: "people", label: "People & Reviews" },
  { key: "resources", label: "Resources" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export function MentorHomeRevamped({
  menteeCount,
  activeMenteeCount,
  pendingReview,
  needsKickoff,
  needsYouCount,
  isAdmin,
  reviews = [],
}: MentorHomeRevampedProps) {
  const [activeTab, setActiveTab] = useState<Tab>("reviews");

  return (
    <div className="flex flex-col gap-6">
      {/* Stat Cards Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCardV2
          label="Reviews to Complete"
          value={pendingReview}
          detail="Mentor reviews pending"
          href="/mentorship/reviews"
          accent="brand"
          selected={activeTab === "reviews"}
        />
        <StatCardV2
          label="Check-ins Due"
          value={2}
          detail="Upcoming this week"
          href="/mentorship/schedule"
          accent="teal"
          selected={activeTab === "check-ins"}
        />
        <StatCardV2
          label="Follow-ups"
          value={needsYouCount}
          detail="Need your attention"
          href="/mentorship/mentees"
          accent="warning"
          selected={activeTab === "follow-ups"}
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
          {activeTab === "reviews" && <ReviewsTab pendingReview={pendingReview} reviews={reviews} />}
          {activeTab === "check-ins" && <CheckInsTab />}
          {activeTab === "follow-ups" && <FollowUpsTab needsYouCount={needsYouCount} />}
          {activeTab === "goals" && <GoalsTab />}
          {activeTab === "people" && <PeopleTab menteeCount={menteeCount} activeMenteeCount={activeMenteeCount} />}
          {activeTab === "resources" && <ResourcesTab />}
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Mentee Progress at a Glance */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Mentee Progress at a Glance</h3>
            <div className="flex flex-col gap-3">
              {[
                { name: "Sarah Greene", team: "Marketing Team", pct: 75 },
                { name: "James Diaz", team: "Product Team", pct: 50 },
                { name: "Katie Wu", team: "Design Team", pct: 60 },
                { name: "Tyler Young", team: "Sales Team", pct: 30 },
                { name: "Alex Kim", team: "Data Team", pct: 80 },
              ].map((mentee) => (
                <div key={mentee.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                        {mentee.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="m-0 text-[13px] font-semibold text-ink">{mentee.name}</p>
                        <p className="m-0 text-[11px] text-ink-muted">{mentee.team}</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-semibold text-ink-muted">{mentee.pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${mentee.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardV2>

          {/* Follow-ups Summary */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <div className="flex items-center justify-between mb-3">
              <h3 className="m-0 text-[14px] font-bold text-ink">Follow-ups</h3>
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">1</span>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  SG
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-[13px] font-semibold text-ink">Sarah Greene</p>
                  <p className="m-0 text-[12px] text-ink-muted">Follow up on goal: Improve presentation skills</p>
                  <p className="m-0 mt-1 text-[11px] font-medium text-red-600">Due May 28, 2024</p>
                </div>
              </div>
            </div>
            <Link href="/mentorship/mentees" className="mt-3 block text-right text-[12px] font-semibold text-brand-700 hover:text-brand-800">
              View all →
            </Link>
          </CardV2>

          {/* Resources for Mentors */}
          <CardV2 padding="md" className="border border-line-soft bg-surface">
            <h3 className="m-0 mb-3 text-[14px] font-bold text-ink">Resources for Mentors</h3>
            <div className="flex flex-col gap-1">
              {[
                { label: "Mentor Best Practices", desc: "Tips to support and empower your mentees", href: "/mentorship/resources" },
                { label: "Conversation Starters", desc: "Build meaningful check-ins", href: "/mentorship/resources" },
                { label: "Goal Setting Guide", desc: "Help mentees navigate their goals", href: "/mentorship/resources" },
              ].map((resource) => (
                <Link
                  key={resource.label}
                  href={resource.href}
                  className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 text-[13px] font-semibold text-ink">{resource.label}</p>
                    <p className="m-0 text-[11px] text-ink-muted">{resource.desc}</p>
                  </div>
                  <svg className="size-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
            </div>
            <Link href="/mentorship/resources" className="mt-3 block text-[12px] font-semibold text-brand-700 hover:text-brand-800">
              View all resources →
            </Link>
          </CardV2>
        </div>
      </div>

      {/* Bottom Banner */}
      <CardV2 padding="lg" className="border border-line-soft bg-gradient-to-r from-brand-50 to-purple-50">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
            </svg>
          </div>
          <div>
            <h3 className="m-0 text-[16px] font-bold text-ink">Thanks for being a great guide.</h3>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">Your support helps your mentees navigate and grow.</p>
          </div>
        </div>
      </CardV2>
    </div>
  );
}

function ReviewsTab({ pendingReview, reviews }: { pendingReview: number; reviews: Array<{ menteeId: string; menteeName: string; team: string; type: string; period: string; dueDate: string; status: string; statusTone: "danger" | "warning" | "default" }> }) {
  const displayReviews = reviews;

  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-red-500" />
          <h3 className="m-0 text-[14px] font-bold text-ink">Reviews to Complete</h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{pendingReview}</span>
        </div>
        <Link href="/mentorship/reviews" className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
          View all reviews
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-line-soft text-[12px] font-semibold text-ink-muted">
              <th className="pb-3 font-medium">Mentee</th>
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">Period</th>
              <th className="pb-3 font-medium">Due Date</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {displayReviews.map((review) => (
              <tr key={review.menteeId} className="group">
                <td className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                      {review.menteeName.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="m-0 text-[13px] font-semibold text-ink">{review.menteeName}</p>
                      <p className="m-0 text-[11px] text-ink-muted">{review.team}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
                    {review.type}
                  </span>
                </td>
                <td className="py-3 text-ink-muted">{review.period}</td>
                <td className="py-3">
                  <span className="text-ink-muted">{review.dueDate}</span>
                  <span className={`ml-2 text-[11px] font-semibold ${review.statusTone === "danger" ? "text-red-600" : review.statusTone === "warning" ? "text-amber-600" : "text-ink-muted"}`}>
                    {review.status}
                  </span>
                </td>
                <td className="py-3">
                  <ButtonLink href={`/mentorship/reviews/${review.menteeId}`} variant="primary" size="sm">
                    Start Review
                  </ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardV2>
  );
}

function CheckInsTab() {
  const checkIns = [
    { id: 1, mentee: "James Diaz", team: "Product Team", date: "Jun 12", time: "2:00 PM", duration: "30 min" },
    { id: 2, mentee: "Katie Wu", team: "Design Team", date: "Jun 15", time: "11:00 AM", duration: "30 min" },
  ];

  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="m-0 text-[14px] font-bold text-ink">Upcoming Check-ins</h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">2</span>
        </div>
        <Link href="/mentorship/schedule" className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
          View calendar
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {checkIns.map((checkIn) => (
          <div key={checkIn.id} className="flex items-center justify-between rounded-lg border border-line-soft bg-surface p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="m-0 text-[13px] font-semibold text-ink">{checkIn.mentee}</p>
                  <span className="text-[11px] text-ink-muted">·</span>
                  <span className="text-[12px] text-ink-muted">{checkIn.team}</span>
                </div>
                <p className="m-0 text-[12px] text-ink-muted">{checkIn.date} at {checkIn.time} · {checkIn.duration}</p>
              </div>
            </div>
            <ButtonLink href={`/mentorship/schedule`} variant="secondary" size="sm">
              Prepare
            </ButtonLink>
          </div>
        ))}
      </div>
    </CardV2>
  );
}

function FollowUpsTab({ needsYouCount }: { needsYouCount: number }) {
  const followUps = [
    { id: 1, mentee: "Sarah Greene", topic: "Follow up on goal: Improve presentation skills", dueDate: "May 28, 2024" },
  ];

  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="m-0 text-[14px] font-bold text-ink">Follow-ups</h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{needsYouCount}</span>
        </div>
        <Link href="/mentorship/mentees" className="text-[12px] font-semibold text-brand-700 hover:text-brand-800">
          View all
        </Link>
      </div>

      {followUps.length === 0 ? (
        <p className="m-0 text-[13px] text-ink-muted">No follow-ups pending. Great job staying on top of things!</p>
      ) : (
        <div className="flex flex-col gap-3">
          {followUps.map((followUp) => (
            <div key={followUp.id} className="flex items-start justify-between rounded-lg border border-line-soft bg-surface p-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                  {followUp.mentee.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="m-0 text-[13px] font-semibold text-ink">{followUp.mentee}</p>
                  <p className="m-0 text-[12px] text-ink-muted">{followUp.topic}</p>
                  <p className="m-0 mt-1 text-[11px] font-medium text-red-600">Due {followUp.dueDate}</p>
                </div>
              </div>
              <ButtonLink href={`/mentorship/mentees`} variant="secondary" size="sm">
                View Details
              </ButtonLink>
            </div>
          ))}
        </div>
      )}
    </CardV2>
  );
}

function GoalsTab() {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Goals & Progress</h3>
      <p className="m-0 text-[13px] text-ink-muted">Track and manage your mentees' goals. View progress, add updates, and celebrate achievements.</p>
      <div className="mt-4 flex flex-col gap-3">
        {[
          { mentee: "Sarah Greene", goal: "Improve public speaking", progress: 75 },
          { mentee: "James Diaz", goal: "Complete product certification", progress: 50 },
          { mentee: "Katie Wu", goal: "Lead design sprint", progress: 60 },
        ].map((item) => (
          <div key={item.mentee} className="flex items-center justify-between rounded-lg border border-line-soft p-3">
            <div>
              <p className="m-0 text-[13px] font-semibold text-ink">{item.mentee}</p>
              <p className="m-0 text-[12px] text-ink-muted">{item.goal}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 rounded-full bg-line-soft">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${item.progress}%` }} />
              </div>
              <span className="text-[12px] font-semibold text-ink-muted">{item.progress}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <ButtonLink href="/mentorship/mentees" variant="secondary" size="sm">
          View all goals →
        </ButtonLink>
      </div>
    </CardV2>
  );
}

function PeopleTab({ menteeCount, activeMenteeCount }: { menteeCount: number; activeMenteeCount: number }) {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">People & Reviews</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/mentorship/mentees" className="rounded-lg border border-line-soft bg-surface-muted p-4 transition-colors hover:border-brand-300 hover:bg-brand-50">
          <p className="m-0 text-[24px] font-bold text-ink">{activeMenteeCount}</p>
          <p className="m-0 mt-1 text-[12px] text-ink-muted">Active mentees</p>
          <p className="m-0 mt-2 text-[11px] font-semibold text-brand-600">View all →</p>
        </Link>
        <div className="rounded-lg border border-line-soft bg-surface-muted p-4">
          <p className="m-0 text-[24px] font-bold text-ink">{menteeCount - activeMenteeCount}</p>
          <p className="m-0 mt-1 text-[12px] text-ink-muted">Inactive / paused</p>
        </div>
      </div>
    </CardV2>
  );
}

function ResourcesTab() {
  return (
    <CardV2 padding="md" className="border border-line-soft bg-surface">
      <h3 className="m-0 mb-4 text-[14px] font-bold text-ink">Resources for Mentors</h3>
      <div className="flex flex-col gap-2">
        {[
          { label: "Mentor Best Practices", desc: "Tips to support and empower your mentees", href: "/mentorship/resources" },
          { label: "Conversation Starters", desc: "Build meaningful check-ins", href: "/mentorship/resources" },
          { label: "Goal Setting Guide", desc: "Help mentees navigate their goals", href: "/mentorship/resources" },
          { label: "Feedback Frameworks", desc: "Structured approaches to giving feedback", href: "/mentorship/resources" },
        ].map((resource) => (
          <Link
            key={resource.label}
            href={resource.href}
            className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-muted"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="m-0 text-[13px] font-semibold text-ink">{resource.label}</p>
              <p className="m-0 text-[11px] text-ink-muted">{resource.desc}</p>
            </div>
            <svg className="size-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>
    </CardV2>
  );
}