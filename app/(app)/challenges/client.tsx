"use client";

import { useState } from "react";
import { joinChallenge, checkInChallenge, dropChallenge } from "@/lib/challenge-gamification-actions";

export function ChallengeCard({ challengeId }: { challengeId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      await joinChallenge(challengeId);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <button
      className="button primary small"
      onClick={handleJoin}
      disabled={loading}
    >
      {loading ? "Joining..." : "Join Challenge"}
    </button>
  );
}

export function CheckInForm({
  challengeId,
  dayNumber,
}: {
  challengeId: string;
  dayNumber: number;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    isComplete: boolean;
    daysCompleted: number;
    streak: number;
  } | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      formData.set("challengeId", challengeId);
      const res = await checkInChallenge(formData);
      setResult(res);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  if (result) {
    return (
      <div style={{ padding: 16, background: result.isComplete ? "#dcfce7" : "var(--ypp-purple-50)", borderRadius: "var(--radius-md)", textAlign: "center" }}>
        {result.isComplete ? (
          <>
            <div style={{ fontSize: 24, marginBottom: 8 }}>Congratulations!</div>
            <div style={{ fontWeight: 600, color: "#16a34a" }}>Challenge Complete!</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 24, marginBottom: 8 }}>Day {result.daysCompleted} done!</div>
            <div style={{ fontWeight: 600, color: "var(--ypp-purple)" }}>
              {result.streak} day streak
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      <h4 style={{ margin: "0 0 12px" }}>Day {dayNumber + 1} Check-In</h4>
      <div className="form-group">
        <label htmlFor="minutesPracticed">Minutes practiced</label>
        <input type="number" id="minutesPracticed" name="minutesPracticed" min="1" max="480" defaultValue="15" />
      </div>
      <div className="form-group">
        <label htmlFor="reflection">Quick reflection (optional)</label>
        <textarea id="reflection" name="reflection" rows={2} placeholder="What did you work on today?" />
      </div>
      <div className="form-group">
        <label htmlFor="workUrl">Link to work (optional)</label>
        <input type="url" id="workUrl" name="workUrl" placeholder="https://..." />
      </div>
      <button type="submit" className="button primary" disabled={loading}>
        {loading ? "Checking in..." : "Check In"}
      </button>
    </form>
  );
}

export function DropButton({ challengeId }: { challengeId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDrop() {
    if (!confirm("Are you sure you want to drop this challenge? You can always rejoin later.")) return;
    setLoading(true);
    try {
      await dropChallenge(challengeId);
    } catch (e: any) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <button
      className="button secondary small"
      onClick={handleDrop}
      disabled={loading}
      style={{ color: "#ef4444" }}
    >
      {loading ? "Dropping..." : "Drop Challenge"}
    </button>
  );
}
