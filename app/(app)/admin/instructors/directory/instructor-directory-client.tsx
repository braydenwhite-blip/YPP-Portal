"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { InstructorOpsRecord, InstructorOpsStage } from "@/lib/instructor-ops";

const STAGES: Array<{ value: InstructorOpsStage; label: string }> = [
  { value: "APPLICANTS", label: "Applicants" },
  { value: "INTERVIEW", label: "Interview" },
  { value: "REVIEW", label: "Review" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "READY", label: "Ready" },
  { value: "ACTIVE", label: "Active" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "PAUSED", label: "Paused" },
  { value: "NEEDS_ATTENTION", label: "Needs Attention" },
];

type InitialFilters = {
  stage: string;
  chapterId: string;
  tag: string;
  load: string;
};

export default function InstructorDirectoryClient({
  records,
  chapters,
  tags,
  initialFilters,
}: {
  records: InstructorOpsRecord[];
  chapters: Array<{ id: string; name: string }>;
  tags: string[];
  initialFilters: InitialFilters;
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState(initialFilters.stage);
  const [chapterId, setChapterId] = useState(initialFilters.chapterId);
  const [tag, setTag] = useState(initialFilters.tag);
  const [load, setLoad] = useState(initialFilters.load);
  const [availability, setAvailability] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [mentorEligible, setMentorEligible] = useState(false);
  const [workshopEligible, setWorkshopEligible] = useState(false);
  const [leadershipTrack, setLeadershipTrack] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((record) => {
      if (stage && record.stage !== stage) return false;
      if (chapterId && record.chapterId !== chapterId) return false;
      if (tag && !record.tags.includes(tag)) return false;
      if (load && record.currentLoadLabel.toLowerCase() !== load.toLowerCase()) return false;
      if (availability && !record.availabilityTags.includes(availability)) return false;
      if (needsAttention && !record.needsAttention) return false;
      if (mentorEligible && !record.mentorEligible) return false;
      if (workshopEligible && !record.workshopEligible) return false;
      if (leadershipTrack && !record.leadershipTrack) return false;
      if (!q) return true;
      return [
        record.name,
        record.email,
        record.chapterName,
        record.stageLabel,
        record.currentLoadLabel,
        record.mentorName ?? "",
        ...record.tags,
        ...record.attentionFlags.map((flag) => `${flag.title} ${flag.detail}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [
    records,
    search,
    stage,
    chapterId,
    tag,
    load,
    availability,
    needsAttention,
    mentorEligible,
    workshopEligible,
    leadershipTrack,
  ]);

  function resetFilters() {
    setSearch("");
    setStage("");
    setChapterId("");
    setTag("");
    setLoad("");
    setAvailability("");
    setNeedsAttention(false);
    setMentorEligible(false);
    setWorkshopEligible(false);
    setLeadershipTrack(false);
  }

  return (
    <div className="instructor-ops-page instructor-directory-page">
      <div className="topbar">
        <div>
          <p className="badge">Admin | Instructor Directory</p>
          <h1 className="page-title">Instructor Directory</h1>
          <p className="page-subtitle">
            Search and filter by pipeline stage, chapter, tags, eligibility,
            availability, load, and attention status.
          </p>
        </div>
        <div className="instructor-ops-header-actions">
          <Link href="/admin/instructors" className="button secondary">
            Pipeline hub
          </Link>
          <Link href="/admin/instructors/attention" className="button">
            Attention inbox
          </Link>
        </div>
      </div>

      <section className="card instructor-directory-filters">
        <div className="instructor-directory-filter-row">
          <input
            className="input"
            placeholder="Search name, email, skill, chapter, or flag..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="input" value={chapterId} onChange={(event) => setChapterId(event.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
              </option>
            ))}
          </select>
          <select className="input" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">All tags</option>
            {tags.map((tagOption) => (
              <option key={tagOption} value={tagOption}>
                {tagOption}
              </option>
            ))}
          </select>
          <select className="input" value={load} onChange={(event) => setLoad(event.target.value)}>
            <option value="">Any load</option>
            <option value="Waiting">Waiting</option>
            <option value="Available">Available</option>
            <option value="Active">Active</option>
            <option value="Overloaded">Overloaded</option>
          </select>
          <select className="input" value={availability} onChange={(event) => setAvailability(event.target.value)}>
            <option value="">Any availability</option>
            <option value="Weekends">Weekends</option>
            <option value="Evenings">Evenings</option>
            <option value="Weekdays">Weekdays</option>
            <option value="Virtual">Virtual</option>
            <option value="In Person">In Person</option>
          </select>
        </div>

        <div className="instructor-directory-chip-row">
          <ToggleChip active={needsAttention} onClick={() => setNeedsAttention((value) => !value)}>
            Needs attention
          </ToggleChip>
          <ToggleChip active={mentorEligible} onClick={() => setMentorEligible((value) => !value)}>
            Mentor eligible
          </ToggleChip>
          <ToggleChip active={workshopEligible} onClick={() => setWorkshopEligible((value) => !value)}>
            Workshop eligible
          </ToggleChip>
          <ToggleChip active={leadershipTrack} onClick={() => setLeadershipTrack((value) => !value)}>
            Leadership track
          </ToggleChip>
          <button type="button" className="button small secondary" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </section>

      <div className="instructor-directory-count">
        Showing <strong>{filtered.length}</strong> of <strong>{records.length}</strong>
      </div>

      <section className="instructor-directory-list">
        {filtered.length === 0 ? (
          <div className="card">
            <p style={{ margin: 0, color: "var(--muted)" }}>
              No instructors match these filters.
            </p>
          </div>
        ) : (
          filtered.map((record) => <DirectoryRow key={record.id} record={record} />)
        )}
      </section>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`instructor-directory-chip${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function DirectoryRow({ record }: { record: InstructorOpsRecord }) {
  return (
    <article className="card instructor-directory-row">
      <div>
        <div className="instructor-directory-row-title">
          <Link href={record.profileHref}>{record.name}</Link>
          <span className={`pill pill-small ${record.needsAttention ? "pill-attention" : "pill-purple"}`}>
            {record.stageLabel}
          </span>
          <span className="pill pill-small">{record.currentLoadLabel}</span>
        </div>
        <p>
          {record.email} | {record.chapterName} | {record.mentorName ? `Mentor: ${record.mentorName}` : "No mentor"}
        </p>
        <div className="instructor-ops-tag-row">
          {record.tags.slice(0, 8).map((rowTag) => (
            <span key={rowTag}>{rowTag}</span>
          ))}
        </div>
      </div>

      <div className="instructor-directory-row-metrics">
        <div>
          <strong>{record.activeAssignmentCount}</strong>
          <span>Active</span>
        </div>
        <div>
          <strong>{record.trainingPercent}%</strong>
          <span>Training</span>
        </div>
        <div>
          <strong>{record.attentionFlags.length}</strong>
          <span>Flags</span>
        </div>
      </div>

      <div className="instructor-directory-row-actions">
        <Link href={record.profileHref} className="button small">
          Profile
        </Link>
        {record.application && (
          <Link href={`/admin/instructor-applicants/${record.application.id}`} className="button small secondary">
            Application
          </Link>
        )}
      </div>
    </article>
  );
}
