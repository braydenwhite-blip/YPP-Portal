import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { getInviteByCode } from "@/lib/chapter-invite-actions";
import { AcceptInviteButton } from "./accept-invite-button";
import Link from "next/link";

export default async function InviteAcceptPage({
  params,
}: {
  params: { code: string };
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/invite/${params.code}`);

  const invite = await getInviteByCode(params.code);

  if (!invite) {
    return (
      <main className="main-content" style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ margin: "0 0 8px" }}>Invite Not Found</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            This invite link doesn&apos;t exist or may have been removed.
          </p>
          <Link href="/chapters" className="button" style={{ marginTop: 16, display: "inline-block" }}>
            Browse Chapters
          </Link>
        </div>
      </main>
    );
  }

  const location = [invite.chapter.city, invite.chapter.region].filter(Boolean).join(", ");

  return (
    <main className="main-content" style={{ maxWidth: 500, margin: "60px auto" }}>
      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {/* Chapter Banner */}
        {invite.chapter.bannerUrl ? (
          <div style={{ height: 140, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invite.chapter.bannerUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              height: 140,
              background: "linear-gradient(135deg, var(--ypp-purple) 0%, var(--ypp-pink) 100%)",
            }}
          />
        )}

        <div style={{ padding: 24 }}>
          {/* Chapter Info */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            {invite.chapter.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invite.chapter.logoUrl}
                alt=""
                style={{
                  width: 52, height: 52, borderRadius: 12, objectFit: "cover",
                  marginTop: -40, border: "3px solid white",
                }}
              />
            ) : (
              <div
                style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: "var(--ypp-purple)", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 20, marginTop: -40,
                  border: "3px solid white",
                }}
              >
                {invite.chapter.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>
                You&apos;re Invited!
              </h2>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: 14 }}>
                Join <strong>{invite.chapter.name}</strong>
              </p>
            </div>
          </div>

          {invite.chapter.tagline && (
            <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
              {invite.chapter.tagline}
            </p>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 13, color: "var(--muted)" }}>
            {location && <span>{location}</span>}
            <span>{invite.chapter._count.users} members</span>
          </div>

          {invite.label && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--bg)",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              Invite: <strong>{invite.label}</strong>
            </div>
          )}

          {/* Accept or Status */}
          {!invite.isValid ? (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 14,
              }}
            >
              {invite.isExpired
                ? "This invite has expired."
                : invite.isFull
                ? "This invite has reached its maximum uses."
                : "This invite is no longer active."}
              <div style={{ marginTop: 8 }}>
                <Link href="/chapters" style={{ color: "#991b1b", fontWeight: 600 }}>
                  Browse chapters instead →
                </Link>
              </div>
            </div>
          ) : (
            <AcceptInviteButton code={params.code} chapterName={invite.chapter.name} />
          )}
        </div>
      </div>
    </main>
  );
}
