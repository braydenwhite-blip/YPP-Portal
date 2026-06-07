import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getSession } from "@/lib/auth-supabase";
import {
  loadPublicProfile,
  type PublicProfilePerson,
} from "@/lib/people-strategy/public-profile";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import { Pill } from "@/components/people-strategy/pills";
import { PersonLink } from "@/components/people-strategy/person-link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

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

function activeLabel(months: number): string {
  if (months <= 0) return "Active · new";
  if (months < 12) return `Active · ${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  return `Active · ${years} ${years === 1 ? "year" : "years"}+`;
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  margin: "0 0 8px",
};

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
  const contactBits = [
    profile.email,
    profile.phone,
    profile.school,
    profile.location,
  ].filter(Boolean) as string[];

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
            background: "var(--ps-accent-soft)",
            color: "var(--ps-accent)",
            border: "1px solid var(--ps-border)",
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
            {` · ${activeLabel(profile.monthsActive)}`}
          </p>
        </div>
      </div>

      {/* Contact — public per the member-profile design. */}
      {contactBits.length > 0 ? (
        <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
          <h2 style={SECTION_LABEL}>Contact</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "var(--ypp-ink)" }}>
            {profile.email ? (
              <span>
                <span style={{ color: "var(--muted)" }}>Email · </span>
                <a href={`mailto:${profile.email}`} style={{ color: "var(--ps-accent)" }}>
                  {profile.email}
                </a>
              </span>
            ) : null}
            {profile.phone ? (
              <span>
                <span style={{ color: "var(--muted)" }}>Phone · </span>
                {profile.phone}
              </span>
            ) : null}
            {profile.school ? (
              <span>
                <span style={{ color: "var(--muted)" }}>School · </span>
                {profile.school}
              </span>
            ) : null}
            {profile.location ? (
              <span>
                <span style={{ color: "var(--muted)" }}>Location · </span>
                {profile.location}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {profile.bio ? (
        <section className="card" style={{ padding: "16px 18px", marginTop: 14 }}>
          <h2 style={SECTION_LABEL}>About</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ypp-ink)" }}>
            {profile.bio}
          </p>
        </section>
      ) : null}

      {/* Mentorship — mentor(s) + mentees, each clickable. */}
      {profile.mentors.length > 0 || profile.mentees.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <CollapsibleSection
            title="Mentorship"
            summary={`${profile.mentors.length} mentor${profile.mentors.length === 1 ? "" : "s"} · ${profile.mentees.length} mentee${profile.mentees.length === 1 ? "" : "s"}`}
            defaultOpen
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {profile.mentors.length > 0 ? (
                <PeopleList
                  label={profile.mentors.length === 1 ? "Mentor" : "Mentors"}
                  people={profile.mentors}
                />
              ) : null}
              {profile.mentees.length > 0 ? (
                <PeopleList label="Mentees" people={profile.mentees} />
              ) : null}
            </div>
          </CollapsibleSection>
        </div>
      ) : null}

      {/* Classes taught — from the Classes system. */}
      {profile.classesTaught.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <CollapsibleSection
            title="Classes Taught"
            summary={`${profile.classesTaught.length} ${profile.classesTaught.length === 1 ? "class" : "classes"}`}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {profile.classesTaught.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{c.title}</span>
                  {c.schedule ? (
                    <span style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                      {c.schedule}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        </div>
      ) : null}

      {/* Current ownership (actions). */}
      <div style={{ marginTop: 14 }}>
        <CollapsibleSection
          title="Projects & Actions"
          summary={totalOwned === 0 ? "None visible" : `${totalOwned} active`}
        >
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
        </CollapsibleSection>
      </div>

      {/* Growth Signals — officer-tier viewers only. */}
      {profile.growthSignals && profile.growthSignals.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <CollapsibleSection
            title="Growth Signals"
            summary="Leadership view only"
          >
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
          </CollapsibleSection>
        </div>
      ) : null}
    </div>
  );
}

function PeopleList({
  label,
  people,
}: {
  label: string;
  people: PublicProfilePerson[];
}) {
  return (
    <div>
      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {people.map((person) => (
          <div key={person.id} style={{ display: "flex", flexDirection: "column" }}>
            <PersonLink
              id={person.id}
              style={{ fontSize: 14, fontWeight: 600, color: "var(--ypp-ink)" }}
            >
              {person.name}
            </PersonLink>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{person.title}</span>
          </div>
        ))}
      </div>
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
