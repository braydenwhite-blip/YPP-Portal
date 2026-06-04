import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import { loadPublicProfile } from "@/lib/people-strategy/public-profile";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import { Pill } from "@/components/people-strategy/pills";

export const dynamic = "force-dynamic";
export const metadata = { title: "Member Profile" };

type PageProps = { params: Promise<{ id: string }> };

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { id } = await params;

  // Any signed-in member may view; signed-out visitors go to login.
  const session = await getSession();
  if (!session?.user?.id) redirect(`/login?next=/people/${id}`);

  const viewer: ActionViewer = {
    id: session.user.id,
    roles: session.user.roles,
    primaryRole: session.user.primaryRole,
    adminSubtypes: session.user.adminSubtypes,
  };

  // Returns null for missing/archived/applicant-only users → 404 (never leaks
  // existence of a non-member account).
  const profile = await loadPublicProfile(id, viewer);
  if (!profile) notFound();

  const totalOwned = profile.actionsLed.length + profile.actionsExecuting.length;

  return (
    <div className="page-shell" style={{ maxWidth: 880 }}>
      <p className="badge">Member Profile</p>

      {/* Identity header */}
      <div
        className="card"
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          padding: "20px 22px",
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "var(--ypp-purple-100)",
            color: "var(--ypp-purple-700)",
            border: "1px solid var(--ypp-purple-200)",
            fontSize: 22,
            fontWeight: 800,
            flex: "0 0 auto",
          }}
          aria-hidden
        >
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- existing avatar pattern.
            <img
              src={profile.avatarUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials(profile.name)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ margin: 0 }}>
            {profile.name}
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 14 }}>
            {profile.title}
            {profile.chapterName ? ` · ${profile.chapterName}` : ""}
            {profile.location ? ` · ${profile.location}` : ""}
          </p>
        </div>
      </div>

      {profile.bio ? (
        <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", margin: "0 0 8px" }}>
            About
          </h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ypp-ink)" }}>
            {profile.bio}
          </p>
        </section>
      ) : null}

      {/* Growth Signals — officer-tier viewers only. */}
      {profile.growthSignals && profile.growthSignals.length > 0 ? (
        <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", margin: "0 0 4px" }}>
            Growth Signals
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
            Leadership view only — not visible to the member or to peers.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {profile.growthSignals.map((signal) => {
              const meta = GROWTH_TAG_META[signal.tag];
              return (
                <Pill key={signal.tag} tone={meta.tone}>
                  {meta.label}
                </Pill>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Current ownership */}
      <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
        <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--muted)", margin: "0 0 10px" }}>
          Current Ownership
        </h2>
        {totalOwned === 0 ? (
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            No active actions you can see.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {profile.actionsLed.length > 0 ? (
              <OwnershipGroup label="Leading" items={profile.actionsLed} />
            ) : null}
            {profile.actionsExecuting.length > 0 ? (
              <OwnershipGroup label="Executing" items={profile.actionsExecuting} />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function OwnershipGroup({
  label,
  items,
}: {
  label: string;
  items: { id: string; title: string; status: string; departmentName: string }[];
}) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
        {label} ({items.length})
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/actions/${item.id}`}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "var(--ypp-ink)",
                fontSize: 14,
              }}
            >
              <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{item.title}</span>
              <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                {item.departmentName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
