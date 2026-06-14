import Link from "next/link";

import type {
  PublicProfile,
  PublicProfilePerson,
} from "@/lib/people-strategy/public-profile";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import { roleExpectsMentor } from "@/lib/people-strategy/people-performance-selectors";
import { Pill } from "@/components/people-strategy/pills";
import { PersonLink } from "@/components/people-strategy/person-link";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

/**
 * Presentational profile sections shared by the full `/people/[id]` page and the
 * slide-in profile drawer. Takes an already-loaded PublicProfile (JSON-safe), so
 * the same layout renders server-side (page) and client-side (drawer fetch).
 * Contact info is public; growth signals are only present for officer viewers.
 */

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--muted)",
  margin: "0 0 8px",
};

export function activeLabel(months: number): string {
  if (months <= 0) return "Active · new";
  if (months < 12) return `Active · ${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.floor(months / 12);
  return `Active · ${years} ${years === 1 ? "year" : "years"}+`;
}

function kudosCategoryLabel(category: string): string {
  return category
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function ProfileBody({ profile }: { profile: PublicProfile }) {
  const totalOwned = profile.actionsLed.length + profile.actionsExecuting.length;
  const contactItems: Array<{ label: string; value: React.ReactNode }> = [];
  if (profile.email)
    contactItems.push({
      label: "Email",
      value: (
        <a href={`mailto:${profile.email}`} style={{ color: "var(--ps-accent)" }}>
          {profile.email}
        </a>
      ),
    });
  if (profile.phone) contactItems.push({ label: "Phone", value: profile.phone });
  if (profile.school) contactItems.push({ label: "School", value: profile.school });
  if (profile.location) contactItems.push({ label: "Location", value: profile.location });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Contact — public per the member-profile design. */}
      {contactItems.length > 0 ? (
        <section className="card" style={{ padding: "16px 18px" }}>
          <h2 style={SECTION_LABEL}>Contact</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, color: "var(--ypp-ink)" }}>
            {contactItems.map((c) => (
              <span key={c.label}>
                <span style={{ color: "var(--muted)" }}>{c.label} · </span>
                {c.value}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {profile.bio ? (
        <section className="card" style={{ padding: "16px 18px" }}>
          <h2 style={SECTION_LABEL}>About</h2>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ypp-ink)" }}>
            {profile.bio}
          </p>
        </section>
      ) : null}

      {/* Mentorship — mentor(s) + mentees, each clickable. */}
      {profile.mentors.length > 0 || profile.mentees.length > 0 ? (
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
      ) : null}

      {/* Mentorship gap — officer view only, for roles the program pairs a
          mentor to (instructors / chapter presidents). Members and peers never
          see this assessment. */}
      {profile.mentors.length === 0 &&
      profile.growthSignals !== null &&
      roleExpectsMentor(profile.primaryRole) ? (
        <section className="card" style={{ padding: "16px 18px" }}>
          <h2 style={SECTION_LABEL}>Mentorship</h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
            No mentor is assigned. Assign a mentor or create a mentorship plan.
          </p>
        </section>
      ) : null}

      {/* Recognition — public peer kudos received. */}
      {profile.kudosTotal > 0 ? (
        <CollapsibleSection
          title="Recognition"
          summary={`${profile.kudosTotal} ${profile.kudosTotal === 1 ? "kudo" : "kudos"}`}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {profile.kudos.map((k) => (
              <div key={k.id} style={{ borderLeft: "3px solid var(--ps-accent)", paddingLeft: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: "var(--ps-accent)",
                    fontWeight: 700,
                  }}
                >
                  {kudosCategoryLabel(k.category)}
                </div>
                <p style={{ margin: "2px 0", fontSize: 14, color: "var(--ypp-ink)" }}>
                  &ldquo;{k.message}&rdquo;
                </p>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  —{" "}
                  <PersonLink id={k.giverId} style={{ color: "var(--muted)" }}>
                    {k.giverName}
                  </PersonLink>
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0" }}>
            <Link href="/peer-recognition" className="button outline small">
              Give kudos
            </Link>
          </p>
        </CollapsibleSection>
      ) : null}

      {/* Classes taught — from the Classes system. */}
      {profile.classesTaught.length > 0 ? (
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
      ) : null}

      {/* Projects & actions. */}
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

      {/* Growth Signals — present only for officer-tier viewers. */}
      {profile.growthSignals && profile.growthSignals.length > 0 ? (
        <CollapsibleSection title="Growth Signals" summary="Leadership view only">
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
