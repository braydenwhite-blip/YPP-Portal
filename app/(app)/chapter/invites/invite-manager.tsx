"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChapterInvite, deactivateInvite } from "@/lib/chapter-invite-actions";

type Invite = {
  id: string;
  code: string;
  label: string | null;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  isExpired: boolean;
  isFull: boolean;
  createdBy: string;
  createdAt: Date;
};

export function InviteManager({ invites }: { invites: Invite[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    try {
      await createChapterInvite(formData);
      setShowCreate(false);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    }
  }

  async function handleDeactivate(id: string) {
    setActionId(id);
    try {
      await deactivateInvite(id);
      startTransition(() => router.refresh());
    } catch {
      // ignore
    } finally {
      setActionId(null);
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function getStatus(invite: Invite): { label: string; color: string; bg: string } {
    if (!invite.isActive) return { label: "Deactivated", color: "#991b1b", bg: "#fef2f2" };
    if (invite.isExpired) return { label: "Expired", color: "#92400e", bg: "#fef3c7" };
    if (invite.isFull) return { label: "Full", color: "#92400e", bg: "#fef3c7" };
    return { label: "Active", color: "#166534", bg: "#dcfce7" };
  }

  return (
    <div>
      {/* Create Form */}
      {showCreate ? (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 12px" }}>Create Invite Link</h3>
          <form action={handleCreate}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Label (optional)</label>
                <input
                  name="label"
                  className="input"
                  placeholder="e.g., Summer Open House, Instagram Bio"
                  style={{ marginTop: 4 }}
                />
              </div>
              <div className="grid two">
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Max Uses</label>
                  <input
                    name="maxUses"
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600 }}>Expires In (days)</label>
                  <input
                    name="expiresInDays"
                    className="input"
                    type="number"
                    min="1"
                    placeholder="Never"
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="button" style={{ fontSize: 13 }}>
                  Create Link
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  style={{
                    fontSize: 13, padding: "6px 14px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "transparent", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <button
          className="button"
          onClick={() => setShowCreate(true)}
          style={{ fontSize: 13, marginBottom: 20 }}
        >
          + Create Invite Link
        </button>
      )}

      {/* Invite List */}
      {invites.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
          <p style={{ fontSize: 14 }}>No invite links yet. Create one to start sharing!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invites.map((invite) => {
            const status = getStatus(invite);
            const isUsable = invite.isActive && !invite.isExpired && !invite.isFull;

            return (
              <div
                key={invite.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: isUsable ? 1 : 0.6,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>
                      {invite.label || invite.code}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: status.bg,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)", display: "flex", gap: 12 }}>
                    <span>
                      {invite.useCount}{invite.maxUses ? `/${invite.maxUses}` : ""} uses
                    </span>
                    {invite.expiresAt && (
                      <span>
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    <span>by {invite.createdBy}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => copyLink(invite.code)}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: copiedCode === invite.code ? "#dcfce7" : "var(--bg)",
                      color: copiedCode === invite.code ? "#166534" : "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCode === invite.code ? "Copied!" : "Copy Link"}
                  </button>
                  {invite.isActive && (
                    <button
                      onClick={() => handleDeactivate(invite.id)}
                      disabled={isPending || actionId === invite.id}
                      style={{
                        fontSize: 12,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
