"use client";

// Admin assignment forms: assign a leadership contribution to an instructor,
// and assign a Student Advisor to one or more students. Used on
// /admin/leadership and the admin instructor profile.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  LeadershipExpectedLevel,
  LeadershipRoleCategory,
} from "@prisma/client";
import { assignContribution } from "@/lib/leadership/contribution-actions";
import { assignStudentAdvisor } from "@/lib/leadership/advisor-actions";
import {
  EXPECTED_LEVEL_META,
  LEADERSHIP_ROLE_CATALOG,
  LEADERSHIP_ROLE_CATEGORIES,
} from "@/lib/leadership/constants";

export type PersonOption = { id: string; name: string };

export function AssignContributionForm({
  instructors,
  fixedInstructorId,
  partners,
}: {
  instructors: PersonOption[];
  /** When set (instructor profile), the instructor select is hidden. */
  fixedInstructorId?: string;
  partners?: PersonOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [instructorId, setInstructorId] = useState(fixedInstructorId ?? "");
  const [category, setCategory] = useState<LeadershipRoleCategory>("STUDENT_ADVISOR");
  const [title, setTitle] = useState("");
  const [expectedLevel, setExpectedLevel] = useState<LeadershipExpectedLevel | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [relatedPartnerId, setRelatedPartnerId] = useState("");
  const [relatedProgram, setRelatedProgram] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const definition = LEADERSHIP_ROLE_CATALOG[category];

  if (!open) {
    return (
      <button className="button" onClick={() => setOpen(true)}>
        + Assign leadership role
      </button>
    );
  }

  return (
    <div className="card" style={{ display: "grid", gap: 10, padding: 16 }}>
      <strong>Assign leadership role</strong>

      {!fixedInstructorId && (
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Instructor
          <select
            value={instructorId}
            onChange={(event) => setInstructorId(event.target.value)}
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Select instructor…</option>
            {instructors.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Role
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as LeadershipRoleCategory)}
          style={{ padding: 6, borderRadius: 6 }}
        >
          {LEADERSHIP_ROLE_CATEGORIES.map((option) => (
            <option key={option} value={option}>
              {LEADERSHIP_ROLE_CATALOG[option].label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>
          {definition.description} Default: {EXPECTED_LEVEL_META[definition.defaultLevel].label},{" "}
          {definition.isOwnership ? "ownership role" : "support role"}.
        </span>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Title (optional — defaults to the role name)
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={definition.label}
          style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </label>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Expected level
          <select
            value={expectedLevel}
            onChange={(event) => setExpectedLevel(event.target.value as LeadershipExpectedLevel | "")}
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Default ({EXPECTED_LEVEL_META[definition.defaultLevel].short})</option>
            {(Object.keys(EXPECTED_LEVEL_META) as LeadershipExpectedLevel[]).map((level) => (
              <option key={level} value={level}>
                {EXPECTED_LEVEL_META[level].label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Weight
          <select
            value={weight}
            onChange={(event) =>
              setWeight(event.target.value === "" ? "" : Number(event.target.value))
            }
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Default ({definition.defaultWeight})</option>
            <option value={1}>1 — light support</option>
            <option value={2}>2 — meaningful</option>
            <option value={3}>3 — major ownership</option>
          </select>
        </label>
      </div>

      {category === "PARTNER_RELATIONSHIP_LEAD" && partners && partners.length > 0 ? (
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Partner
          <select
            value={relatedPartnerId}
            onChange={(event) => setRelatedPartnerId(event.target.value)}
            style={{ padding: 6, borderRadius: 6 }}
          >
            <option value="">Select partner…</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          Related program / initiative (optional)
          <input
            value={relatedProgram}
            onChange={(event) => setRelatedProgram(event.target.value)}
            placeholder="e.g. Robotics 201, Spring recruiting, Mentorship cohort 3"
            style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb" }}
          />
        </label>
      )}

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Notes / expectations (optional)
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </label>

      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button"
          disabled={isPending || !(fixedInstructorId ?? instructorId)}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await assignContribution({
                  instructorId: fixedInstructorId ?? instructorId,
                  category,
                  title: title.trim() || undefined,
                  expectedLevel: expectedLevel || undefined,
                  weight: weight === "" ? undefined : weight,
                  relatedPartnerId: relatedPartnerId || undefined,
                  relatedProgram: relatedProgram.trim() || undefined,
                  notes: notes.trim() || undefined,
                });
                setOpen(false);
                setTitle("");
                setNotes("");
                setRelatedProgram("");
                setRelatedPartnerId("");
                router.refresh();
              } catch {
                setError("Could not assign the role. Check the inputs and try again.");
              }
            });
          }}
        >
          {isPending ? "Assigning…" : "Assign role"}
        </button>
        <button className="button ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AssignAdvisorForm({
  advisors,
  students,
}: {
  advisors: PersonOption[];
  students: PersonOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [advisorId, setAdvisorId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const pool = query
      ? students.filter((student) => student.name.toLowerCase().includes(query))
      : students;
    return pool.slice(0, 12);
  }, [students, search]);

  if (!open) {
    return (
      <button className="button secondary" onClick={() => setOpen(true)}>
        + Assign Student Advisor
      </button>
    );
  }

  function toggleStudent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="card" style={{ display: "grid", gap: 10, padding: 16 }}>
      <strong>Assign Student Advisor</strong>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Advisor (instructor)
        <select
          value={advisorId}
          onChange={(event) => setAdvisorId(event.target.value)}
          style={{ padding: 6, borderRadius: 6 }}
        >
          <option value="">Select advisor…</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
        Students ({selected.size} selected)
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search students…"
          style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb" }}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {filteredStudents.map((student) => {
          const isSelected = selected.has(student.id);
          return (
            <button
              key={student.id}
              onClick={() => toggleStudent(student.id)}
              className={`pill pill-small ${isSelected ? "pill-purple" : "pill-neutral"}`}
              style={{ cursor: "pointer", border: "none" }}
            >
              {isSelected ? "✓ " : ""}
              {student.name}
            </button>
          );
        })}
        {filteredStudents.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>No students match.</span>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="button"
          disabled={isPending || !advisorId || selected.size === 0}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await assignStudentAdvisor({
                  advisorId,
                  studentIds: Array.from(selected),
                });
                setOpen(false);
                setSelected(new Set());
                setAdvisorId("");
                router.refresh();
              } catch {
                setError("Could not assign the advisor. Try again.");
              }
            });
          }}
        >
          {isPending ? "Assigning…" : `Assign to ${selected.size} student${selected.size === 1 ? "" : "s"}`}
        </button>
        <button className="button ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
