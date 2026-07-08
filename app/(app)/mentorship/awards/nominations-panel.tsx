"use client";

import { useState, useTransition } from "react";
import {
  nominateForAward,
  chairApproveNomination,
  boardApproveNomination,
  rejectNomination,
} from "@/lib/award-nomination-actions";
import { TIER_CONFIG } from "@/lib/award-tier-config";
import type { AchievementAwardTier } from "@prisma/client";

const TIER_ORDER: AchievementAwardTier[] = ["BRONZE", "SILVER", "GOLD", "LIFETIME"];

export interface EligibleMentee {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  totalPoints: number;
  currentTier: string | null;
  eligibleTiers: AchievementAwardTier[];
  approvedTiers: AchievementAwardTier[];
  pendingTiers: AchievementAwardTier[];
}

export interface NominationItem {
  id: string;
  tier: AchievementAwardTier;
  status: string;
  nomineeName: string;
  nomineeEmail: string;
  nomineeRole: string;
  nominatorName: string;
  totalPoints: number;
  notes: string | null;
  chairApproverName: string | null;
  chairApprovedAt: string | null;
  boardApproverName: string | null;
  boardApprovedAt: string | null;
  createdAt: string;
}

interface Props {
  eligibleMentees: EligibleMentee[];
  nominations: NominationItem[];
  isAdmin: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PENDING_CHAIR: { label: "Pending Chair", cls: "pill pill-pending" },
  PENDING_BOARD: { label: "Pending Board", cls: "pill pill-pending" },
  APPROVED: { label: "Approved", cls: "pill pill-success" },
  REJECTED: { label: "Rejected", cls: "pill pill-declined" },
};

const ROLE_LABELS: Record<string, string> = {
  INSTRUCTOR: "Instructor",
  CHAPTER_PRESIDENT: "Chapter President",
  ADMIN: "Global Leadership",
  STAFF: "Global Leadership",
};

export default function NominationsPanel({ eligibleMentees, nominations, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  function handleAction(
    action: (fd: FormData) => Promise<void>,
    formData: FormData,
    successMsg: string
  ) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await action(formData);
        setSuccess(successMsg);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  function handleNominate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    handleAction(nominateForAward, fd, "Nomination submitted successfully.");
    (e.target as HTMLFormElement).reset();
  }

  const filtered =
    statusFilter === "ALL"
      ? nominations
      : nominations.filter((n) => n.status === statusFilter);

  const pendingChair = nominations.filter((n) => n.status === "PENDING_CHAIR");
  const pendingBoard = nominations.filter((n) => n.status === "PENDING_BOARD");

  return (
    <div>
      {/* Nominate form */}
      {eligibleMentees.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p className="section-title" style={{ marginBottom: "1rem" }}>
            Nominate for Award
          </p>
          <form onSubmit={handleNominate}>
            <div className="form-grid">
              <div className="form-row">
                <label>Mentee</label>
                <select name="nomineeId" required>
                  <option value="">— select mentee —</option>
                  {eligibleMentees.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.userName} ({ROLE_LABELS[m.userRole] ?? m.userRole}) — {m.totalPoints} pts
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Award Tier</label>
                <select name="tier" required>
                  <option value="">— select tier —</option>
                  {TIER_ORDER.map((tier) => {
                    const cfg = TIER_CONFIG[tier];
                    return (
                      <option key={tier} value={tier}>
                        {cfg.emoji} {cfg.label} ({cfg.min}+ pts)
                        {cfg.requiresBoard ? " — Board Approval Required" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>Notes (optional)</label>
                <textarea name="notes" rows={2} placeholder="Reason for nomination…" />
              </div>
            </div>
            {error && <p style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>{error}</p>}
            {success && <p style={{ color: "var(--color-success)", marginTop: "0.5rem" }}>{success}</p>}
            <button className="button primary" type="submit" disabled={isPending} style={{ marginTop: "0.75rem" }}>
              {isPending ? "Nominating…" : "Submit Nomination"}
            </button>
          </form>
        </div>
      )}

      {/* Eligible mentees overview */}
      {eligibleMentees.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Eligible for Nomination ({eligibleMentees.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {eligibleMentees.map((m) => (
              <div
                key={m.userId}
                className="card"
                style={{ padding: "0.7rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{m.userName}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: "0.5rem" }}>
                    {ROLE_LABELS[m.userRole] ?? m.userRole} · {m.totalPoints} pts
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {m.eligibleTiers.map((tier) => {
                    const cfg = TIER_CONFIG[tier];
                    return (
                      <span
                        key={tier}
                        className="pill"
                        style={{ background: cfg.bg, color: cfg.color, fontSize: "0.72rem" }}
                      >
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action queues */}
      {(pendingChair.length > 0 || pendingBoard.length > 0) && (
        <div style={{ marginBottom: "1.5rem" }}>
          <p className="section-title" style={{ marginBottom: "0.75rem" }}>
            Action Required
          </p>
          {[...pendingChair, ...pendingBoard].map((n) => {
            const tierCfg = TIER_CONFIG[n.tier];
            const isChairPending = n.status === "PENDING_CHAIR";
            const isBoardPending = n.status === "PENDING_BOARD" && isAdmin;

            return (
              <div
                key={n.id}
                className="card"
                style={{
                  marginBottom: "0.5rem",
                  borderLeft: `4px solid ${tierCfg.color}`,
                  padding: "0.9rem 1.1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 700 }}>{tierCfg.emoji} {tierCfg.label} Award</span>
                      <span className={STATUS_CONFIG[n.status]?.cls ?? "pill"} style={{ fontSize: "0.72rem" }}>
                        {STATUS_CONFIG[n.status]?.label ?? n.status}
                      </span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0.2rem 0 0" }}>
                      {n.nomineeName} · {n.totalPoints} pts · Nominated by {n.nominatorName}
                    </p>
                    {n.notes && (
                      <p style={{ color: "var(--muted)", fontSize: "0.8rem", fontStyle: "italic", margin: "0.2rem 0 0" }}>
                        "{n.notes}"
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {(isChairPending || isBoardPending) && (
                      <button
                        className="button primary small"
                        disabled={isPending}
                        onClick={() => {
                          const fd = new FormData();
                          fd.set("nominationId", n.id);
                          handleAction(
                            isChairPending ? chairApproveNomination : boardApproveNomination,
                            fd,
                            `${n.nomineeName}'s ${n.tier} nomination approved!`
                          );
                        }}
                      >
                        {isChairPending
                          ? tierCfg.requiresBoard
                            ? "Approve → Board"
                            : "Approve"
                          : "Board Approve"}
                      </button>
                    )}
                    <button
                      className="button outline small"
                      disabled={isPending}
                      style={{ color: "#c2410c", borderColor: "#fca5a5" }}
                      onClick={() => {
                        if (!confirm(`Reject the ${n.tier} nomination for ${n.nomineeName}?`)) return;
                        const fd = new FormData();
                        fd.set("nominationId", n.id);
                        handleAction(rejectNomination, fd, "Nomination rejected.");
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All nominations */}
      <div>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
          <p className="section-title" style={{ margin: 0, flex: 1 }}>
            All Nominations ({nominations.length})
          </p>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All Statuses</option>
            <option value="PENDING_CHAIR">Pending Chair</option>
            <option value="PENDING_BOARD">Pending Board</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: "var(--muted)", fontStyle: "italic" }}>No nominations match this filter.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="th">Mentee</th>
                  <th className="th">Tier</th>
                  <th className="th">Points</th>
                  <th className="th">Status</th>
                  <th className="th">Nominated By</th>
                  <th className="th">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const cfg = TIER_CONFIG[n.tier];
                  const statusCfg = STATUS_CONFIG[n.status];
                  return (
                    <tr key={n.id}>
                      <td className="td">
                        <div style={{ fontWeight: 500 }}>{n.nomineeName}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {ROLE_LABELS[n.nomineeRole] ?? n.nomineeRole}
                        </div>
                      </td>
                      <td className="td">
                        <span className="pill" style={{ background: cfg.bg, color: cfg.color, fontSize: "0.75rem" }}>
                          {cfg.emoji} {cfg.label}
                        </span>
                      </td>
                      <td className="td" style={{ fontWeight: 600 }}>{n.totalPoints}</td>
                      <td className="td">
                        <span className={statusCfg?.cls ?? "pill"} style={{ fontSize: "0.75rem" }}>
                          {statusCfg?.label ?? n.status}
                        </span>
                      </td>
                      <td className="td" style={{ fontSize: "0.85rem" }}>{n.nominatorName}</td>
                      <td className="td" style={{ fontSize: "0.82rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
