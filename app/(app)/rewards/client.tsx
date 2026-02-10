"use client";

import { useState } from "react";
import { redeemRandomReward, openMysteryBox } from "@/lib/engagement-actions";

export function RedeemRewardButton({ rewardId }: { rewardId: string }) {
  const [redeemed, setRedeemed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRedeem() {
    setLoading(true);
    try {
      await redeemRandomReward(rewardId);
      setRedeemed(true);
    } catch {}
    setLoading(false);
  }

  if (redeemed) {
    return <span style={{ color: "#16a34a", fontWeight: 600, fontSize: 13 }}>Redeemed!</span>;
  }

  return (
    <button onClick={handleRedeem} disabled={loading} className="button primary small">
      {loading ? "..." : "Redeem"}
    </button>
  );
}

export function OpenMysteryBoxButton({ boxId }: { boxId: string }) {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      const box = await openMysteryBox(boxId);
      setResult(box);
    } catch {}
    setLoading(false);
  }

  if (result) {
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed", marginBottom: 4 }}>
          {(result as any).rewardTitle}!
        </div>
        {(result as any).xpAmount > 0 && (
          <div style={{ fontSize: 12, color: "#d97706" }}>+{(result as any).xpAmount} XP</div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleOpen}
      disabled={loading}
      className="button primary"
      style={{ background: "#7c3aed" }}
    >
      {loading ? "Opening..." : "Open Box"}
    </button>
  );
}

export function RandomRewardBanner({ reward }: { reward: any }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 24,
        background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
        border: "2px solid #d97706",
        textAlign: "center",
        position: "relative",
      }}
    >
      <button
        onClick={() => setDismissed(true)}
        style={{
          position: "absolute", top: 8, right: 12,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 16, color: "var(--text-secondary)",
        }}
      >
        x
      </button>
      <div style={{ fontSize: 28, marginBottom: 4 }}>★</div>
      <h3 style={{ margin: "0 0 4px", color: "#92400e" }}>Surprise Reward!</h3>
      <p style={{ fontSize: 14, color: "#92400e", margin: "0 0 4px" }}>{reward.title}</p>
      {reward.description && (
        <p style={{ fontSize: 12, color: "#a16207", margin: "0 0 8px" }}>{reward.description}</p>
      )}
      {reward.xpAmount > 0 && (
        <div style={{ fontSize: 16, fontWeight: 700, color: "#d97706" }}>+{reward.xpAmount} XP</div>
      )}
    </div>
  );
}
