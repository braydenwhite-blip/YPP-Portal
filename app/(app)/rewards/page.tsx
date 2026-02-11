import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyRewards, getMyMysteryBoxes, checkRandomReward } from "@/lib/engagement-actions";
import { RedeemRewardButton, OpenMysteryBoxButton, RandomRewardBanner } from "./client";

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [rewards, mysteryBoxes, randomDrop] = await Promise.all([
    getMyRewards(),
    getMyMysteryBoxes(),
    checkRandomReward(),
  ]);

  const unopenedBoxes = (mysteryBoxes as any[]).filter((b) => !b.isOpened);
  const openedBoxes = (mysteryBoxes as any[]).filter((b) => b.isOpened);
  const unredeemedRewards = (rewards as any[]).filter((r) => !r.isRedeemed);
  const redeemedRewards = (rewards as any[]).filter((r) => r.isRedeemed);

  const rewardTypeEmojis: Record<string, string> = {
    BONUS_XP: "★", STREAK_SHIELD: "⊘", DOUBLE_XP: "×2",
    XP_BOOST: "★", RARE_BADGE: "◆", TITLE: "≡", THEME_UNLOCK: "◈",
  };

  const rewardTypeColors: Record<string, string> = {
    BONUS_XP: "#d97706", STREAK_SHIELD: "#3b82f6", DOUBLE_XP: "#7c3aed",
    XP_BOOST: "#d97706", RARE_BADGE: "#ec4899", TITLE: "#16a34a", THEME_UNLOCK: "#06b6d4",
  };

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Rewards</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Mystery boxes, surprise drops, and special rewards
          </p>
        </div>
      </div>

      {/* Random Reward Drop Banner */}
      {randomDrop && <RandomRewardBanner reward={randomDrop as any} />}

      {/* Stats Row */}
      <div className="grid three" style={{ marginBottom: 28 }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>{unopenedBoxes.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Unopened Boxes</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{unredeemedRewards.length}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Pending Rewards</div>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>
            {openedBoxes.length + redeemedRewards.length}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Total Collected</div>
        </div>
      </div>

      {/* Unopened Mystery Boxes */}
      {unopenedBoxes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Mystery Boxes</h2>
          <div className="grid three">
            {unopenedBoxes.map((box: any) => (
              <div
                key={box.id}
                className="card"
                style={{
                  textAlign: "center",
                  border: "2px dashed #7c3aed",
                  background: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 8 }}>?</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Mystery Box</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Earned from: {box.triggerType.replace(/_/g, " ").toLowerCase()}
                </div>
                {box.triggerDetail && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
                    {box.triggerDetail.replace(/_/g, " ")}
                  </div>
                )}
                <OpenMysteryBoxButton boxId={box.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unredeemed Random Rewards */}
      {unredeemedRewards.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Pending Rewards</h2>
          <div className="grid two">
            {unredeemedRewards.map((reward: any) => (
              <div key={reward.id} className="card" style={{ borderLeft: `4px solid ${rewardTypeColors[reward.rewardType] || "#7c3aed"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20 }}>{rewardTypeEmojis[reward.rewardType] || "★"}</span>
                      <h4 style={{ margin: 0 }}>{reward.title}</h4>
                    </div>
                    {reward.description && (
                      <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
                        {reward.description}
                      </p>
                    )}
                    {reward.xpAmount > 0 && (
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#d97706", marginTop: 4 }}>
                        +{reward.xpAmount} XP
                      </div>
                    )}
                  </div>
                  <RedeemRewardButton rewardId={reward.id} />
                </div>
                {reward.expiresAt && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>
                    Expires: {new Date(reward.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opened Boxes */}
      {openedBoxes.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Opened Mystery Boxes</h2>
          <div className="grid three">
            {openedBoxes.map((box: any) => (
              <div key={box.id} className="card" style={{ opacity: 0.75 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{rewardTypeEmojis[box.rewardType] || "★"}</span>
                  <h4 style={{ margin: 0, fontSize: 14 }}>{box.rewardTitle}</h4>
                </div>
                {box.xpAmount > 0 && (
                  <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>+{box.xpAmount} XP</span>
                )}
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  Opened {new Date(box.openedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {unopenedBoxes.length === 0 && unredeemedRewards.length === 0 && openedBoxes.length === 0 && redeemedRewards.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>?</div>
          <h3>No rewards yet</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            Complete challenges, build streaks, and level up to earn mystery boxes and surprise rewards!
          </p>
        </div>
      )}
    </div>
  );
}
