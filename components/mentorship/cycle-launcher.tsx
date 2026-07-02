"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button, CardV2, StatusBadge, cn } from "@/components/ui-v2";
import {
  launchReviewCycle,
  previewReviewCycleCohort,
} from "@/lib/mentorship/cycle-actions";
import { ROLE_GROUP_LABELS, type RoleGroup } from "@/lib/mentorship/cohort";

/**
 * Cohort Review Launcher — pick who (a role group, a chapter, a lifecycle
 * lane, or hand-picked people), preview exactly who that is, then launch.
 * One code path whether it's one person or eighty.
 */

export type LauncherChapterOption = { id: string; name: string };
export type LauncherLaneOption = { id: string; title: string };
export type LauncherPersonOption = {
  id: string;
  name: string;
  contextLabel: string | null;
  population: "instructor" | "officer";
};

type ScopeType = "role-group" | "chapter" | "lane" | "custom";

const SCOPE_CARDS: Array<{ type: ScopeType; title: string; blurb: string }> = [
  {
    type: "role-group",
    title: "Role group",
    blurb: "All new instructors, all instructors, chapter presidents, or officers.",
  },
  { type: "chapter", title: "Chapter", blurb: "Everyone who runs one chapter." },
  {
    type: "lane",
    title: "Lifecycle lane",
    blurb: "Start reviews from a lane — e.g. everyone with “Review due.”",
  },
  {
    type: "custom",
    title: "Specific people",
    blurb: "Hand-pick exactly who this cycle covers.",
  },
];

type Preview = { count: number; label: string; sampleNames: string[] };

export function CycleLauncher({
  chapters,
  lanes,
  people,
  initialPersonId = null,
  initialLane = null,
}: {
  chapters: LauncherChapterOption[];
  lanes: LauncherLaneOption[];
  people: LauncherPersonOption[];
  /** Preselect one person (custom scope) — e.g. from a cockpit card link. */
  initialPersonId?: string | null;
  /** Preselect a lifecycle lane — e.g. from a cockpit lane header link. */
  initialLane?: { id: string; population: "instructor" | "officer" } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<"monthly" | "quarterly">("monthly");
  const [scopeType, setScopeType] = useState<ScopeType>(
    initialPersonId ? "custom" : initialLane ? "lane" : "role-group"
  );
  const [roleGroup, setRoleGroup] = useState<RoleGroup>("new-instructors");
  const [chapterId, setChapterId] = useState(chapters[0]?.id ?? "");
  const [laneId, setLaneId] = useState(initialLane?.id ?? lanes[0]?.id ?? "concern");
  const [lanePopulation, setLanePopulation] = useState<"instructor" | "officer">(
    initialLane?.population ?? "instructor"
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initialPersonId ? [initialPersonId] : [])
  );
  const [personQuery, setPersonQuery] = useState("");
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo(() => {
    switch (scopeType) {
      case "role-group":
        return { type: "role-group" as const, group: roleGroup };
      case "chapter":
        return { type: "chapter" as const, chapterId };
      case "lane":
        return {
          type: "lane" as const,
          lane: laneId as never,
          population: lanePopulation,
        };
      case "custom":
        return { type: "custom" as const, userIds: [...selectedIds] };
    }
  }, [scopeType, roleGroup, chapterId, laneId, lanePopulation, selectedIds]);

  const filteredPeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    const base = q
      ? people.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.contextLabel ?? "").toLowerCase().includes(q)
        )
      : people;
    return base.slice(0, 30);
  }, [people, personQuery]);

  function refreshPreview() {
    setError(null);
    setPreview(null);
    startTransition(async () => {
      try {
        const result = await previewReviewCycleCohort(scope);
        if (result.ok) {
          setPreview({
            count: result.count,
            label: result.label,
            sampleNames: result.sampleNames,
          });
        } else {
          setError(result.error);
        }
      } catch {
        setError("Couldn't preview that cohort — check the selection.");
      }
    });
  }

  function launch() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await launchReviewCycle({
          kind,
          name: name.trim() || undefined,
          dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : undefined,
          scope,
        });
        if (result.ok) {
          router.push(`/mentorship/cycles/${result.cycleId}`);
        } else {
          setError(result.error);
        }
      } catch {
        setError("Launch failed — check the selection and try again.");
      }
    });
  }

  const selectClass =
    "w-full rounded-[10px] border border-line-soft bg-surface px-3 py-2 text-[13px] text-ink";

  return (
    <div className="grid gap-5">
      {/* Kind */}
      <CardV2 padding="md">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">What kind of review?</h3>
        <div className="mt-2 flex gap-2">
          {(
            [
              ["monthly", "Monthly", "Self-reflection → mentor review → chair release."],
              ["quarterly", "Quarterly", "Leadership calibration (performance × potential)."],
            ] as const
          ).map(([value, label, blurb]) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn(
                "flex-1 rounded-[10px] border px-3 py-2.5 text-left",
                kind === value
                  ? "border-brand-600 bg-brand-50"
                  : "border-line-soft bg-surface hover:border-brand-300"
              )}
            >
              <span className="block text-[13px] font-semibold text-ink">{label}</span>
              <span className="mt-0.5 block text-[11.5px] text-ink-muted">{blurb}</span>
            </button>
          ))}
        </div>
      </CardV2>

      {/* Scope */}
      <CardV2 padding="md">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">Who is this cycle for?</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SCOPE_CARDS.map((card) => (
            <button
              key={card.type}
              type="button"
              onClick={() => {
                setScopeType(card.type);
                setPreview(null);
              }}
              className={cn(
                "rounded-[10px] border px-3 py-2.5 text-left",
                scopeType === card.type
                  ? "border-brand-600 bg-brand-50"
                  : "border-line-soft bg-surface hover:border-brand-300"
              )}
            >
              <span className="block text-[13px] font-semibold text-ink">{card.title}</span>
              <span className="mt-0.5 block text-[11.5px] text-ink-muted">{card.blurb}</span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          {scopeType === "role-group" ? (
            <select
              aria-label="Role group"
              className={selectClass}
              value={roleGroup}
              onChange={(e) => {
                setRoleGroup(e.target.value as RoleGroup);
                setPreview(null);
              }}
            >
              {Object.entries(ROLE_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}

          {scopeType === "chapter" ? (
            chapters.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-muted">No chapters found.</p>
            ) : (
              <select
                aria-label="Chapter"
                className={selectClass}
                value={chapterId}
                onChange={(e) => {
                  setChapterId(e.target.value);
                  setPreview(null);
                }}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )
          ) : null}

          {scopeType === "lane" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Lane"
                className={selectClass}
                value={laneId}
                onChange={(e) => {
                  setLaneId(e.target.value);
                  setPreview(null);
                }}
              >
                {lanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.title}
                  </option>
                ))}
              </select>
              <select
                aria-label="Population"
                className={selectClass}
                value={lanePopulation}
                onChange={(e) => {
                  setLanePopulation(e.target.value as "instructor" | "officer");
                  setPreview(null);
                }}
              >
                <option value="instructor">Instructors</option>
                <option value="officer">Officers</option>
              </select>
            </div>
          ) : null}

          {scopeType === "custom" ? (
            <div className="grid gap-2">
              <input
                type="search"
                placeholder="Search people…"
                aria-label="Search people"
                className={selectClass}
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
              />
              <ul className="m-0 grid max-h-64 list-none gap-1 overflow-y-auto p-0">
                {filteredPeople.map((person) => {
                  const checked = selectedIds.has(person.id);
                  return (
                    <li key={person.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-1.5",
                          checked
                            ? "border-brand-600 bg-brand-50"
                            : "border-line-soft bg-surface"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(person.id)) next.delete(person.id);
                              else next.add(person.id);
                              return next;
                            });
                            setPreview(null);
                          }}
                        />
                        <span className="text-[13px] text-ink">{person.name}</span>
                        {person.contextLabel ? (
                          <span className="text-[11.5px] text-ink-muted">
                            {person.contextLabel}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="m-0 text-[12px] text-ink-muted">
                {selectedIds.size} selected
              </p>
            </div>
          ) : null}
        </div>
      </CardV2>

      {/* Optional details */}
      <CardV2 padding="md">
        <h3 className="m-0 text-[13.5px] font-bold text-ink">Details (optional)</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="Cycle name (auto-named if blank)"
            aria-label="Cycle name"
            className={selectClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
          />
          <input
            type="date"
            aria-label="Due date"
            className={selectClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </CardV2>

      {/* Preview + launch */}
      <CardV2 padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            {preview ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="brand">
                  {preview.count} {preview.count === 1 ? "person" : "people"}
                </StatusBadge>
                <span className="text-[13px] font-semibold text-ink">{preview.label}</span>
                <span className="text-[12px] text-ink-muted">
                  {preview.sampleNames.join(", ")}
                  {preview.count > preview.sampleNames.length ? "…" : ""}
                </span>
              </div>
            ) : (
              <p className="m-0 text-[12.5px] text-ink-muted">
                Preview who this launch covers before starting it.
              </p>
            )}
            {error ? <p className="m-0 mt-1 text-[12.5px] text-danger-700">{error}</p> : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" disabled={pending} onClick={refreshPreview}>
              {pending ? "…" : "Preview cohort"}
            </Button>
            <Button
              size="sm"
              disabled={pending || (scopeType === "custom" && selectedIds.size === 0)}
              onClick={launch}
            >
              {pending ? "Launching…" : "Launch cycle"}
            </Button>
          </div>
        </div>
      </CardV2>
    </div>
  );
}
