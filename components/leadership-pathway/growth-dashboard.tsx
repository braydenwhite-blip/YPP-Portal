"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STATUS_LEVELS,
  STATUS_LEVEL_ORDER,
  TRACKS,
  TRACK_ORDER,
  expectationsFor,
  getNextRole,
  getRole,
  type PathwayCompetency,
  type PathwayRole,
  type StatusLevelId,
  type TrackConfig,
  type TrackId,
} from "@/lib/growth-pathway";

/* ------------------------------------------------------------------ *
 * Persisted per-user, per-track state (localStorage-backed).
 * The schema-less store keeps the redesign self-contained: ratings,
 * notes, next steps, and evidence persist locally and are ready to be
 * wired to the portal's data layer later.
 * ------------------------------------------------------------------ */

interface EvidenceItem {
  id: string;
  text: string;
  competencyId: string | null;
  date: string;
  author: string;
}

interface TrackState {
  statuses: Record<string, StatusLevelId>;
  notes: string;
  nextSteps: string[];
  evidence: EvidenceItem[];
}

function storageKey(userId: string, trackId: TrackId) {
  return `ypp-growth:${userId}:${trackId}`;
}

function seedState(track: TrackConfig, userName: string): TrackState {
  const statuses: Record<string, StatusLevelId> = {};
  track.competencies.forEach((c, i) => {
    // A plausible, varied starting picture so the dashboard reads as live.
    statuses[c.id] =
      i === track.competencies.length - 1 ? "NEEDS_ATTENTION" : "ON_TRACK";
  });
  return {
    statuses,
    notes: "",
    nextSteps: [],
    evidence: [
      {
        id: "seed-1",
        text: `Welcome to your growth pathway, ${userName.split(" ")[0] || "there"}. Log a win here whenever you make progress — it builds the case for your next promotion.`,
        competencyId: null,
        date: new Date().toISOString(),
        author: "YPP Pathways",
      },
    ],
  };
}

function loadState(
  userId: string,
  track: TrackConfig,
  userName: string
): TrackState {
  if (typeof window === "undefined") return seedState(track, userName);
  try {
    const raw = window.localStorage.getItem(storageKey(userId, track.id));
    if (!raw) return seedState(track, userName);
    const parsed = JSON.parse(raw) as Partial<TrackState>;
    const seeded = seedState(track, userName);
    return {
      statuses: { ...seeded.statuses, ...(parsed.statuses ?? {}) },
      notes: parsed.notes ?? "",
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence
        : seeded.evidence,
    };
  } catch {
    return seedState(track, userName);
  }
}

/* ------------------------------------------------------------------ *
 * Small presentational helpers
 * ------------------------------------------------------------------ */

function StatusPill({
  status,
  size = "md",
}: {
  status: StatusLevelId;
  size?: "sm" | "md";
}) {
  const s = STATUS_LEVELS[status];
  return (
    <span
      className={`gp-status gp-status--${s.tone} ${size === "sm" ? "gp-status--sm" : ""}`}
    >
      <span className="gp-status__dot" aria-hidden />
      {s.label}
    </span>
  );
}

function RoleBadge({ role, current }: { role: PathwayRole; current?: boolean }) {
  return (
    <span className={`gp-rolebadge ${current ? "is-current" : ""}`}>
      {role.label}
    </span>
  );
}

function ProgressMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="gp-meter"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="gp-meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Readiness computation
 * ------------------------------------------------------------------ */

function computeReadiness(track: TrackConfig, statuses: Record<string, StatusLevelId>) {
  const total = track.competencies.length;
  let sum = 0;
  let atRisk = 0;
  let above = 0;
  let onOrAbove = 0;
  track.competencies.forEach((c) => {
    const st = statuses[c.id] ?? "ON_TRACK";
    sum += STATUS_LEVELS[st].fill;
    if (st === "AT_RISK") atRisk += 1;
    if (st === "ABOVE_AND_BEYOND") above += 1;
    if (st === "ABOVE_AND_BEYOND" || st === "ON_TRACK") onOrAbove += 1;
  });
  const pct = Math.round((sum / total) * 100);

  let verdict: { label: string; tone: string; line: string };
  if (atRisk > 0) {
    verdict = {
      label: "Needs Focus",
      tone: "risk",
      line: `${atRisk} ${atRisk === 1 ? "competency is" : "competencies are"} at risk. Address ${atRisk === 1 ? "it" : "these"} before a promotion case is ready.`,
    };
  } else if (onOrAbove === total && above >= Math.ceil(total / 2)) {
    verdict = {
      label: "Promotion-Ready",
      tone: "above",
      line: "Consistently meeting or exceeding every competency. This is a strong case for the next role.",
    };
  } else if (onOrAbove === total) {
    verdict = {
      label: "On Track",
      tone: "ontrack",
      line: "All competencies are being met. Push a few into Above & Beyond to build a promotion case.",
    };
  } else {
    verdict = {
      label: "Building",
      tone: "attention",
      line: "Most competencies are on track. Close the remaining gaps to move toward promotion readiness.",
    };
  }
  return { pct, verdict, above, onOrAbove, atRisk, total };
}

interface PromotionGate {
  label: string;
  met: boolean;
}

function computePromotionGates(
  track: TrackConfig,
  statuses: Record<string, StatusLevelId>,
  evidenceCount: number
): PromotionGate[] {
  const r = computeReadiness(track, statuses);
  const half = Math.ceil(track.competencies.length / 2);
  return [
    { label: "No competency is At Risk", met: r.atRisk === 0 },
    {
      label: "Every competency is at least On Track",
      met: r.onOrAbove === r.total,
    },
    {
      label: `At least ${half} competencies Above & Beyond`,
      met: r.above >= half,
    },
    { label: "At least 3 pieces of evidence logged", met: evidenceCount >= 3 },
  ];
}

/** Smart, sorted "what to do next" suggestions from the weakest areas. */
function computeRecommendations(
  track: TrackConfig,
  statuses: Record<string, StatusLevelId>
): Array<{ id: string; title: string; line: string; status: StatusLevelId }> {
  const rank: Record<StatusLevelId, number> = {
    AT_RISK: 0,
    NEEDS_ATTENTION: 1,
    ON_TRACK: 2,
    ABOVE_AND_BEYOND: 3,
  };
  const recs = track.competencies
    .map((c) => ({ c, status: statuses[c.id] ?? "ON_TRACK" }))
    .sort((a, b) => rank[a.status] - rank[b.status])
    .slice(0, 3)
    .map(({ c, status }) => {
      let line: string;
      if (status === "AT_RISK")
        line = `Urgent: close the major gaps in "${c.shortTitle}". Pair with your mentor this week.`;
      else if (status === "NEEDS_ATTENTION")
        line = `Tighten up "${c.shortTitle}" — meet every bullet to move it to On Track.`;
      else if (status === "ON_TRACK")
        line = `Stretch "${c.shortTitle}" toward Above & Beyond to strengthen your promotion case.`;
      else
        line = `Keep sustaining your Above & Beyond work in "${c.shortTitle}" — log the evidence.`;
      return { id: c.id, title: c.title, line, status };
    });
  return recs;
}

/* ------------------------------------------------------------------ *
 * Main dashboard
 * ------------------------------------------------------------------ */

export interface GrowthDashboardProps {
  userId: string;
  userName: string;
  isAdmin: boolean;
  initialTrackId: TrackId;
  initialRoleId: string;
  mentor?: { name: string; role: string } | null;
}

export function GrowthDashboard({
  userId,
  userName,
  isAdmin,
  initialTrackId,
  initialRoleId,
  mentor = null,
}: GrowthDashboardProps) {
  const [trackId, setTrackId] = useState<TrackId>(initialTrackId);
  const [roleId, setRoleId] = useState<string>(initialRoleId);
  const [openCompetency, setOpenCompetency] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const track = TRACKS[trackId];
  const role = getRole(track, roleId) ?? track.roles[0];
  const nextRole = getNextRole(track, role.id);

  // Per-track state, hydrated from localStorage after mount.
  const [stateByTrack, setStateByTrack] = useState<Record<TrackId, TrackState>>(
    () => ({
      INSTRUCTOR: seedState(TRACKS.INSTRUCTOR, userName),
      LEADERSHIP: seedState(TRACKS.LEADERSHIP, userName),
    })
  );

  useEffect(() => {
    setStateByTrack({
      INSTRUCTOR: loadState(userId, TRACKS.INSTRUCTOR, userName),
      LEADERSHIP: loadState(userId, TRACKS.LEADERSHIP, userName),
    });
    setHydrated(true);
  }, [userId, userName]);

  const state = stateByTrack[trackId];

  const persist = useCallback(
    (next: TrackState) => {
      setStateByTrack((prev) => ({ ...prev, [trackId]: next }));
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            storageKey(userId, trackId),
            JSON.stringify(next)
          );
        } catch {
          /* storage full / unavailable — non-fatal */
        }
      }
    },
    [trackId, userId]
  );

  const readiness = useMemo(
    () => computeReadiness(track, state.statuses),
    [track, state.statuses]
  );

  // When switching tracks, keep the role valid for that track.
  const switchTrack = (next: TrackId) => {
    setTrackId(next);
    setOpenCompetency(null);
    const cur =
      next === initialTrackId ? initialRoleId : TRACKS[next].roles[0].id;
    setRoleId(getRole(TRACKS[next], cur) ? cur : TRACKS[next].roles[0].id);
  };

  const setStatus = (competencyId: string, status: StatusLevelId) =>
    persist({
      ...state,
      statuses: { ...state.statuses, [competencyId]: status },
    });

  const addEvidence = (text: string, competencyId: string | null) => {
    if (!text.trim()) return;
    const item: EvidenceItem = {
      id: `ev-${Date.now()}`,
      text: text.trim(),
      competencyId,
      date: new Date().toISOString(),
      author: userName,
    };
    persist({ ...state, evidence: [item, ...state.evidence] });
  };

  const removeEvidence = (id: string) =>
    persist({ ...state, evidence: state.evidence.filter((e) => e.id !== id) });

  const evidenceCount = state.evidence.filter(
    (e) => !e.id.startsWith("seed-")
  ).length;

  const gates = useMemo(
    () => computePromotionGates(track, state.statuses, evidenceCount),
    [track, state.statuses, evidenceCount]
  );
  const recommendations = useMemo(
    () => computeRecommendations(track, state.statuses),
    [track, state.statuses]
  );

  const [evidencePreset, setEvidencePreset] = useState<string | null>(null);
  const focusEvidence = (competencyId: string) => {
    setOpenCompetency(null);
    setEvidencePreset(competencyId);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() =>
        document
          .getElementById("gp-evidence-anchor")
          ?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
    }
  };

  const resetTrack = () => {
    const fresh = seedState(track, userName);
    persist(fresh);
  };

  return (
    <div className="gp-root">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="gp-hero">
        <div className="gp-hero__glow" aria-hidden />
        <div className="gp-hero__content">
          <span className="gp-hero__eyebrow">YPP Growth Pathway</span>
          <h1 className="gp-hero__title">Your YPP Growth Pathway</h1>
          <p className="gp-hero__lede">
            Understand your role, your next step, what&apos;s expected, and what
            to do next — all in one place. This is the home for instructor and
            leadership growth at YPP.
          </p>

          <div className="gp-hero__controls">
            <div className="gp-trackswitch" role="tablist" aria-label="Pathway track">
              {TRACK_ORDER.map((tid) => (
                <button
                  key={tid}
                  role="tab"
                  aria-selected={tid === trackId}
                  className={`gp-trackswitch__btn ${tid === trackId ? "is-active" : ""}`}
                  onClick={() => switchTrack(tid)}
                >
                  {TRACKS[tid].label}
                </button>
              ))}
            </div>
            <div className="gp-hero__tools">
              <button
                className="gp-hero__tool"
                onClick={() => window.print()}
                title="Print or export your growth summary"
              >
                ⎙ Export
              </button>
              {isAdmin && (
                <button
                  className="gp-hero__tool"
                  onClick={resetTrack}
                  title="Reset ratings, notes and evidence for this track"
                >
                  ↺ Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission banner ─────────────────────────────────── */}
      <section className="gp-mission">
        <span className="gp-mission__label">Role mission</span>
        <p className="gp-mission__text">{track.mission}</p>
        {mentor && (
          <p className="gp-mission__support">
            <span aria-hidden>🤝</span> Supported by{" "}
            <strong>{mentor.name}</strong>
            <span className="gp-mission__support-role"> · {mentor.role}</span>
          </p>
        )}
      </section>

      {/* ── Role cards row ─────────────────────────────────── */}
      <section className="gp-rolerow">
        <CurrentRoleCard track={track} role={role} readiness={readiness} />
        <NextRoleCard track={track} nextRole={nextRole} />
        <ReadinessCard
          readiness={readiness}
          nextRole={nextRole}
          onReview={() => isAdmin && setAdminOpen(true)}
          isAdmin={isAdmin}
        />
      </section>

      {/* ── Pathway ladder ─────────────────────────────────── */}
      <section className="gp-section">
        <div className="gp-section__head">
          <h2 className="gp-section__title">{track.label} ladder</h2>
          <p className="gp-section__sub">
            Click any rung to explore what that role looks like.
          </p>
        </div>
        <Ladder
          track={track}
          currentRoleId={role.id}
          onSelect={(id) => {
            setRoleId(id);
            setOpenCompetency(null);
          }}
        />
      </section>

      {/* ── Promotion readiness + recommendations ──────────── */}
      <section className="gp-section">
        <div className="gp-section__head">
          <h2 className="gp-section__title">Promotion readiness</h2>
          <p className="gp-section__sub">
            {nextRole
              ? `What it takes to be ready for ${nextRole.label}.`
              : "Stewardship checkpoints at the top of the pathway."}
          </p>
        </div>
        <div className="gp-readyrow">
          <div className="gp-gates">
            <div className="gp-gates__head">
              <span className={`gp-readiness__badge gp-tone--${readiness.verdict.tone}`}>
                {readiness.verdict.label}
              </span>
              <span className="gp-gates__count">
                {gates.filter((g) => g.met).length}/{gates.length} criteria met
              </span>
            </div>
            <ul className="gp-gates__list">
              {gates.map((g, i) => (
                <li key={i} className={`gp-gate ${g.met ? "is-met" : ""}`}>
                  <span className="gp-gate__check" aria-hidden>
                    {g.met ? "✓" : ""}
                  </span>
                  <span>{g.label}</span>
                </li>
              ))}
            </ul>
            {nextRole?.promotionWindow && (
              <p className="gp-gates__window">{nextRole.promotionWindow}</p>
            )}
          </div>

          <div className="gp-recs">
            <h3 className="gp-recs__title">What to focus on next</h3>
            <ul className="gp-recs__list">
              {recommendations.map((r) => (
                <li key={r.id} className="gp-rec">
                  <span className={`gp-rec__dot gp-tone--${STATUS_LEVELS[r.status].tone}`} aria-hidden />
                  <div>
                    <strong>{r.title}</strong>
                    <p>{r.line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Competency cards ───────────────────────────────── */}
      <section className="gp-section">
        <div className="gp-section__head">
          <h2 className="gp-section__title">
            Your {track.competencies.length} growth areas
          </h2>
          <p className="gp-section__sub">
            Expectations shown for <strong>{role.label}</strong>. Click a card
            for the full rubric across every role.
          </p>
        </div>
        <div className="gp-compgrid">
          {track.competencies.map((c) => (
            <CompetencyCard
              key={c.id}
              competency={c}
              role={role}
              status={state.statuses[c.id] ?? "ON_TRACK"}
              onOpen={() => setOpenCompetency(c.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Evidence + Admin ───────────────────────────────── */}
      <div className="gp-lower" id="gp-evidence-anchor">
        <EvidenceFeed
          track={track}
          evidence={state.evidence}
          onAdd={addEvidence}
          onRemove={removeEvidence}
          hydrated={hydrated}
          presetTag={evidencePreset}
          onPresetApplied={() => setEvidencePreset(null)}
        />
        <StatusLegend />
      </div>

      {isAdmin && (
        <AdminPanel
          open={adminOpen}
          onToggle={() => setAdminOpen((o) => !o)}
          track={track}
          role={role}
          state={state}
          onSetStatus={setStatus}
          onNotes={(notes) => persist({ ...state, notes })}
          onNextSteps={(nextSteps) => persist({ ...state, nextSteps })}
        />
      )}

      {/* ── Detail drawer ──────────────────────────────────── */}
      {openCompetency && (
        <CompetencyDrawer
          track={track}
          competency={
            track.competencies.find((c) => c.id === openCompetency)!
          }
          currentRoleId={role.id}
          status={state.statuses[openCompetency] ?? "ON_TRACK"}
          onClose={() => setOpenCompetency(null)}
          onLogEvidence={focusEvidence}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Role cards
 * ------------------------------------------------------------------ */

function CurrentRoleCard({
  track,
  role,
  readiness,
}: {
  track: TrackConfig;
  role: PathwayRole;
  readiness: ReturnType<typeof computeReadiness>;
}) {
  return (
    <article className="gp-card gp-card--current">
      <span className="gp-card__eyebrow">Current role</span>
      <div className="gp-card__rolehead">
        <h3 className="gp-card__role">{role.label}</h3>
        <RoleBadge role={role} current />
      </div>
      {role.subtitle && <p className="gp-card__subtitle">{role.subtitle}</p>}
      <p className="gp-card__mission">{role.mission}</p>
      <div className="gp-card__metric">
        <div className="gp-card__metric-row">
          <span>Overall standing</span>
          <strong>{readiness.pct}%</strong>
        </div>
        <ProgressMeter value={readiness.pct / 100} />
      </div>
      <p className="gp-card__foot">{track.label}</p>
    </article>
  );
}

function NextRoleCard({
  track,
  nextRole,
}: {
  track: TrackConfig;
  nextRole: PathwayRole | null;
}) {
  if (!nextRole) {
    return (
      <article className="gp-card gp-card--next gp-card--top">
        <span className="gp-card__eyebrow">Next role</span>
        <h3 className="gp-card__role">Top of the pathway</h3>
        <p className="gp-card__mission">
          You&apos;re at the highest rung of the {track.label.toLowerCase()}.
          Focus now is on stewardship — building what outlasts your role and
          developing the next generation of leaders.
        </p>
      </article>
    );
  }
  return (
    <article className="gp-card gp-card--next">
      <span className="gp-card__eyebrow">Next role</span>
      <div className="gp-card__rolehead">
        <h3 className="gp-card__role">{nextRole.label}</h3>
        <span className="gp-rolebadge gp-rolebadge--next">Up next</span>
      </div>
      {nextRole.subtitle && (
        <p className="gp-card__subtitle">{nextRole.subtitle}</p>
      )}
      <p className="gp-card__mission">{nextRole.mission}</p>
    </article>
  );
}

function ReadinessCard({
  readiness,
  nextRole,
  onReview,
  isAdmin,
}: {
  readiness: ReturnType<typeof computeReadiness>;
  nextRole: PathwayRole | null;
  onReview: () => void;
  isAdmin: boolean;
}) {
  const v = readiness.verdict;
  return (
    <article className={`gp-card gp-card--readiness gp-tone--${v.tone}`}>
      <span className="gp-card__eyebrow">Promotion readiness</span>
      <div className="gp-readiness__verdict">
        <span className={`gp-readiness__badge gp-tone--${v.tone}`}>
          {v.label}
        </span>
      </div>
      <p className="gp-card__mission">{v.line}</p>
      <div className="gp-readiness__stats">
        <div>
          <strong>{readiness.above}</strong>
          <span>Above &amp; Beyond</span>
        </div>
        <div>
          <strong>
            {readiness.onOrAbove}/{readiness.total}
          </strong>
          <span>Meeting bar</span>
        </div>
        <div>
          <strong>{readiness.atRisk}</strong>
          <span>At risk</span>
        </div>
      </div>
      {nextRole && (
        <p className="gp-readiness__target">
          Targeting <strong>{nextRole.label}</strong>
        </p>
      )}
      {isAdmin && (
        <button className="gp-btn gp-btn--soft" onClick={onReview}>
          Open review tools
        </button>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * Ladder / stepper
 * ------------------------------------------------------------------ */

function Ladder({
  track,
  currentRoleId,
  onSelect,
}: {
  track: TrackConfig;
  currentRoleId: string;
  onSelect: (id: string) => void;
}) {
  const currentRole = getRole(track, currentRoleId);
  // For a parallel role (e.g. Chapter President), "you are here" anchors to
  // the rung it runs beside so progress still reads correctly.
  const currentOrder = currentRole
    ? currentRole.parallelToOrder ?? currentRole.order
    : 0;
  const onParallel = currentRole?.parallelToOrder !== undefined;

  return (
    <div className="gp-ladderwrap">
      <ol className="gp-ladder">
        {track.roles.map((r) => {
          const state =
            r.order < currentOrder
              ? "done"
              : r.order === currentOrder
                ? "current"
                : "future";
          const isYou = r.id === currentRoleId;
          const branches = track.parallelRoles.filter(
            (p) => p.parallelToOrder === r.order
          );
          return (
            <li key={r.id} className={`gp-ladder__item is-${state}`}>
              <button
                className="gp-ladder__btn"
                onClick={() => onSelect(r.id)}
                aria-current={isYou ? "step" : undefined}
              >
                <span className="gp-ladder__node">{r.order + 1}</span>
                <span className="gp-ladder__label">{r.label}</span>
                {isYou && <span className="gp-ladder__you">You are here</span>}
              </button>

              {branches.length > 0 && (
                <div className="gp-ladder__branches">
                  {branches.map((p) => {
                    const pYou = p.id === currentRoleId;
                    return (
                      <button
                        key={p.id}
                        className={`gp-ladder__branch ${pYou ? "is-current" : ""}`}
                        onClick={() => onSelect(p.id)}
                        aria-current={pYou ? "step" : undefined}
                      >
                        <span className="gp-ladder__branch-tie" aria-hidden />
                        <span className="gp-ladder__branch-label">
                          {p.label}
                          <em>parallel stage</em>
                        </span>
                        {pYou && (
                          <span className="gp-ladder__you">You are here</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {onParallel && (
        <p className="gp-ladder__note">
          {currentRole?.label} runs parallel to {track.roles[currentOrder]?.label}{" "}
          on the leadership pathway — same competency bar, a region-focused
          remit.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Competency card
 * ------------------------------------------------------------------ */

function CompetencyCard({
  competency,
  role,
  status,
  onOpen,
}: {
  competency: PathwayCompetency;
  role: PathwayRole;
  status: StatusLevelId;
  onOpen: () => void;
}) {
  const bullets = expectationsFor(competency, role);
  return (
    <button className="gp-comp" onClick={onOpen} aria-haspopup="dialog">
      <div className="gp-comp__top">
        <span className="gp-comp__num">{competency.number}</span>
        <StatusPill status={status} size="sm" />
      </div>
      <h3 className="gp-comp__title">{competency.title}</h3>
      <p className="gp-comp__one">{competency.oneLiner}</p>
      <ul className="gp-comp__bullets">
        {bullets.slice(0, 2).map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      <div className="gp-comp__foot">
        <ProgressMeter value={STATUS_LEVELS[status].fill} />
        <span className="gp-comp__more">View rubric →</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Detail drawer
 * ------------------------------------------------------------------ */

function CompetencyDrawer({
  track,
  competency,
  currentRoleId,
  status,
  onClose,
  onLogEvidence,
}: {
  track: TrackConfig;
  competency: PathwayCompetency;
  currentRoleId: string;
  status: StatusLevelId;
  onClose: () => void;
  onLogEvidence: (competencyId: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Unique bands so we don't render duplicate columns (Chapter President
  // shares the Director band).
  const seen = new Set<string>();
  const rolesByBand = track.roles.filter((r) => {
    if (seen.has(r.bandKey)) return false;
    seen.add(r.bandKey);
    return true;
  });

  return (
    <div className="gp-drawer" role="dialog" aria-modal="true" aria-label={competency.title}>
      <div className="gp-drawer__scrim" onClick={onClose} />
      <div className="gp-drawer__panel">
        <div className="gp-drawer__head">
          <div>
            <span className="gp-drawer__eyebrow">
              Growth area {competency.number} · {track.chip}
            </span>
            <h2 className="gp-drawer__title">{competency.title}</h2>
            <p className="gp-drawer__one">{competency.oneLiner}</p>
          </div>
          <button className="gp-drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="gp-drawer__statusrow">
          <span className="gp-drawer__statuslbl">Your current status</span>
          <StatusPill status={status} />
          <button
            className="gp-btn gp-btn--soft gp-drawer__logbtn"
            onClick={() => onLogEvidence(competency.id)}
          >
            + Log evidence
          </button>
        </div>

        <div className="gp-drawer__cols">
          {rolesByBand.map((r) => {
            const isCurrentBand =
              getRole(track, currentRoleId)?.bandKey === r.bandKey;
            return (
              <div
                key={r.bandKey}
                className={`gp-drawer__col ${isCurrentBand ? "is-current" : ""}`}
              >
                <div className="gp-drawer__colhead">
                  <h3>{r.label}</h3>
                  {r.subtitle && <span>{r.subtitle}</span>}
                  {isCurrentBand && (
                    <span className="gp-drawer__colyou">Your level</span>
                  )}
                </div>
                <ul className="gp-drawer__bullets">
                  {expectationsFor(competency, r).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Evidence of Growth feed
 * ------------------------------------------------------------------ */

function EvidenceFeed({
  track,
  evidence,
  onAdd,
  onRemove,
  hydrated,
  presetTag = null,
  onPresetApplied,
}: {
  track: TrackConfig;
  evidence: EvidenceItem[];
  onAdd: (text: string, competencyId: string | null) => void;
  onRemove: (id: string) => void;
  hydrated: boolean;
  presetTag?: string | null;
  onPresetApplied?: () => void;
}) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState<string>("");

  // Pre-select a growth area when the drawer asks to log evidence for one.
  useEffect(() => {
    if (presetTag) {
      setTag(presetTag);
      onPresetApplied?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTag]);

  const compName = (id: string | null) =>
    id ? track.competencies.find((c) => c.id === id)?.shortTitle ?? null : null;

  const submit = () => {
    onAdd(text, tag || null);
    setText("");
    setTag("");
  };

  return (
    <section className="gp-section gp-evidence">
      <div className="gp-section__head">
        <h2 className="gp-section__title">Evidence of Growth</h2>
        <p className="gp-section__sub">
          Log wins, feedback, and milestones. This is the record that builds
          your promotion case.
        </p>
      </div>

      <div className="gp-evidence__composer">
        <textarea
          className="gp-evidence__input"
          placeholder="What did you accomplish? e.g. “Ran a parent showcase that lifted attendance 20%.”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
        />
        <div className="gp-evidence__composer-foot">
          <select
            className="gp-evidence__select"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            aria-label="Tag a growth area"
          >
            <option value="">No growth area</option>
            {track.competencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortTitle}
              </option>
            ))}
          </select>
          <button
            className="gp-btn gp-btn--primary"
            onClick={submit}
            disabled={!text.trim()}
          >
            Add evidence
          </button>
        </div>
      </div>

      <ul className="gp-evidence__feed">
        {hydrated && evidence.length === 0 && (
          <li className="gp-evidence__empty">
            No evidence logged yet — add your first win above.
          </li>
        )}
        {evidence.map((e) => (
          <li key={e.id} className="gp-evidence__item">
            <div className="gp-evidence__bullet" aria-hidden />
            <div className="gp-evidence__body">
              <p className="gp-evidence__text">{e.text}</p>
              <div className="gp-evidence__meta">
                {compName(e.competencyId) && (
                  <span className="gp-evidence__tag">
                    {compName(e.competencyId)}
                  </span>
                )}
                <span>{e.author}</span>
                {hydrated && (
                  <>
                    <span>·</span>
                    <span>
                      {new Date(e.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
            {!e.id.startsWith("seed-") && (
              <button
                className="gp-evidence__del"
                onClick={() => onRemove(e.id)}
                aria-label="Remove evidence"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Status legend
 * ------------------------------------------------------------------ */

function StatusLegend() {
  return (
    <section className="gp-section gp-legend">
      <div className="gp-section__head">
        <h2 className="gp-section__title">Status levels</h2>
        <p className="gp-section__sub">How each growth area is rated.</p>
      </div>
      <ul className="gp-legend__list">
        {STATUS_LEVEL_ORDER.map((id) => {
          const s = STATUS_LEVELS[id];
          return (
            <li key={id} className="gp-legend__row">
              <StatusPill status={id} size="sm" />
              <span className="gp-legend__desc">{s.description}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Admin review panel
 * ------------------------------------------------------------------ */

function AdminPanel({
  open,
  onToggle,
  track,
  role,
  state,
  onSetStatus,
  onNotes,
  onNextSteps,
}: {
  open: boolean;
  onToggle: () => void;
  track: TrackConfig;
  role: PathwayRole;
  state: TrackState;
  onSetStatus: (competencyId: string, status: StatusLevelId) => void;
  onNotes: (notes: string) => void;
  onNextSteps: (steps: string[]) => void;
}) {
  const [stepDraft, setStepDraft] = useState("");

  const addStep = () => {
    if (!stepDraft.trim()) return;
    onNextSteps([...state.nextSteps, stepDraft.trim()]);
    setStepDraft("");
  };

  return (
    <section className={`gp-admin ${open ? "is-open" : ""}`}>
      <button className="gp-admin__bar" onClick={onToggle} aria-expanded={open}>
        <span className="gp-admin__bar-left">
          <span className="gp-admin__shield" aria-hidden>
            ★
          </span>
          Admin review tools
          <span className="gp-admin__hint">
            Set ratings, notes &amp; next steps for {role.label}
          </span>
        </span>
        <span className="gp-admin__chev">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="gp-admin__body">
          <div className="gp-admin__ratings">
            <h3 className="gp-admin__h">Competency ratings</h3>
            {track.competencies.map((c) => {
              const cur = state.statuses[c.id] ?? "ON_TRACK";
              return (
                <div key={c.id} className="gp-admin__rating">
                  <span className="gp-admin__rating-name">{c.title}</span>
                  <div className="gp-admin__seg">
                    {STATUS_LEVEL_ORDER.map((sid) => (
                      <button
                        key={sid}
                        className={`gp-admin__segbtn gp-tone--${STATUS_LEVELS[sid].tone} ${cur === sid ? "is-active" : ""}`}
                        onClick={() => onSetStatus(c.id, sid)}
                      >
                        {STATUS_LEVELS[sid].label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="gp-admin__side">
            <div className="gp-admin__block">
              <h3 className="gp-admin__h">Reviewer notes</h3>
              <textarea
                className="gp-admin__notes"
                rows={5}
                placeholder="Coaching notes, context, and observations for this review cycle…"
                value={state.notes}
                onChange={(e) => onNotes(e.target.value)}
              />
            </div>

            <div className="gp-admin__block">
              <h3 className="gp-admin__h">Next steps</h3>
              <ul className="gp-admin__steps">
                {state.nextSteps.map((s, i) => (
                  <li key={i}>
                    <span>{s}</span>
                    <button
                      aria-label="Remove step"
                      onClick={() =>
                        onNextSteps(state.nextSteps.filter((_, j) => j !== i))
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {state.nextSteps.length === 0 && (
                  <li className="gp-admin__steps-empty">
                    No next steps yet.
                  </li>
                )}
              </ul>
              <div className="gp-admin__steprow">
                <input
                  className="gp-admin__stepinput"
                  placeholder="Add a next step…"
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStep()}
                />
                <button className="gp-btn gp-btn--soft" onClick={addStep}>
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
