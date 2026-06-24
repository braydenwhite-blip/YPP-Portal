import Link from "next/link";
import type { ReactNode } from "react";

import type {
  PublicProfile,
  PublicProfilePerson,
} from "@/lib/people-strategy/public-profile";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import { roleExpectsMentor } from "@/lib/people-strategy/people-performance-selectors";
import { Pill } from "@/components/people-strategy/pills";
import { PersonLink } from "@/components/people-strategy/person-link";
import { cn } from "@/components/ui-v2";

/**
 * Presentational profile sections shared by the full `/people/[id]` page and the
 * slide-in profile drawer.
 */

const CARD =
  "overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]";

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

function ProfileSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={cn(CARD, "group")} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-[15px] font-semibold text-[#1c1a2e]">{title}</span>
        <span className="flex items-center gap-2 text-[12.5px] text-[#9a9ab0]">
          {summary ? <span>{summary}</span> : null}
          <span className="transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-[#f1f1f6] px-5 pb-4 pt-3">{children}</div>
    </details>
  );
}

export function ProfileBody({
  profile,
  compact = false,
}: {
  profile: PublicProfile;
  compact?: boolean;
}) {
  const totalOwned = profile.actionsLed.length + profile.actionsExecuting.length;
  const contactItems: Array<{ label: string; value: ReactNode }> = [];
  if (profile.email) {
    contactItems.push({
      label: "Email",
      value: (
        <a href={`mailto:${profile.email}`} className="text-[#5a1da8] no-underline hover:underline">
          {profile.email}
        </a>
      ),
    });
  }
  if (profile.phone) contactItems.push({ label: "Phone", value: profile.phone });
  if (profile.school) contactItems.push({ label: "School", value: profile.school });
  if (profile.location) contactItems.push({ label: "Location", value: profile.location });

  const hasMentorship =
    profile.mentors.length > 0 ||
    profile.mentees.length > 0 ||
    (profile.growthSignals !== null && roleExpectsMentor(profile.primaryRole));

  const hasMoreDetails =
    hasMentorship ||
    profile.kudosTotal > 0 ||
    profile.classesTaught.length > 0 ||
    totalOwned > 0 ||
    (profile.growthSignals !== null && profile.growthSignals.length > 0);

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {contactItems.length > 0 ? (
          <div className={cn(CARD, "px-4 py-3.5")}>
            <div className="flex flex-col gap-1.5 text-[14px] text-[#3a3a52]">
              {contactItems.map((item) => (
                <div key={item.label} className="flex flex-wrap gap-1.5">
                  <span className="text-[#9a9ab0]">{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {profile.bio ? (
          <div className={cn(CARD, "px-4 py-3.5")}>
            <p className="m-0 text-[14px] leading-relaxed text-[#3a3a52]">{profile.bio}</p>
          </div>
        ) : null}

        {hasMoreDetails ? (
          <ProfileSection title="More details" summary="Mentorship, work, recognition">
            <ProfileExtraSections
              profile={profile}
              hasMentorship={hasMentorship}
              totalOwned={totalOwned}
              inline
            />
          </ProfileSection>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {contactItems.length > 0 ? (
        <ProfileSection title="Contact" defaultOpen>
          <div className="flex flex-col gap-2 text-[14px] text-[#3a3a52]">
            {contactItems.map((item) => (
              <div key={item.label} className="flex flex-wrap gap-1">
                <span className="text-[#9a9ab0]">{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </ProfileSection>
      ) : null}

      {profile.bio ? (
        <ProfileSection title="About" defaultOpen>
          <p className="m-0 text-[14px] leading-relaxed text-[#3a3a52]">{profile.bio}</p>
        </ProfileSection>
      ) : null}

      <ProfileExtraSections
        profile={profile}
        hasMentorship={hasMentorship}
        totalOwned={totalOwned}
      />
    </div>
  );
}

function ProfileExtraSections({
  profile,
  hasMentorship,
  totalOwned,
  inline = false,
}: {
  profile: PublicProfile;
  hasMentorship: boolean;
  totalOwned: number;
  inline?: boolean;
}) {
  const wrap = (title: string, summary: string | undefined, children: ReactNode) =>
    inline ? (
      <div className="border-t border-[#f1f1f6] pt-3 first:border-t-0 first:pt-0">
        <p className="m-0 mb-2 text-[13px] font-semibold text-[#1c1a2e]">{title}</p>
        {children}
      </div>
    ) : (
      <ProfileSection title={title} summary={summary}>
        {children}
      </ProfileSection>
    );

  return (
    <>
      {hasMentorship
        ? wrap(
            "Mentorship",
            `${profile.mentors.length} mentor${profile.mentors.length === 1 ? "" : "s"} · ${profile.mentees.length} mentee${profile.mentees.length === 1 ? "" : "s"}`,
            <div className="flex flex-col gap-4">
              {profile.mentors.length > 0 ? (
                <PeopleList
                  label={profile.mentors.length === 1 ? "Mentor" : "Mentors"}
                  people={profile.mentors}
                />
              ) : profile.growthSignals !== null && roleExpectsMentor(profile.primaryRole) ? (
                <p className="m-0 text-[14px] text-[#717189]">No mentor assigned yet.</p>
              ) : null}
              {profile.mentees.length > 0 ? (
                <PeopleList label="Mentees" people={profile.mentees} />
              ) : null}
            </div>
          )
        : null}

      {profile.kudosTotal > 0
        ? wrap(
            "Recognition",
            `${profile.kudosTotal} ${profile.kudosTotal === 1 ? "kudo" : "kudos"}`,
            <>
              <div className="flex flex-col gap-3">
                {profile.kudos.map((k) => (
                  <div key={k.id} className="border-l-2 border-[#5a1da8] pl-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5a1da8]">
                      {kudosCategoryLabel(k.category)}
                    </div>
                    <p className="m-0 mt-1 text-[14px] text-[#3a3a52]">&ldquo;{k.message}&rdquo;</p>
                    <div className="mt-1 text-[12px] text-[#9a9ab0]">
                      —{" "}
                      <PersonLink id={k.giverId} className="text-[#717189] no-underline hover:underline">
                        {k.giverName}
                      </PersonLink>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mb-0 mt-3">
                <Link
                  href="/peer-recognition"
                  className="inline-flex rounded-lg border border-[#ebebf2] px-3 py-1.5 text-[12.5px] font-semibold text-[#3a3a52] no-underline hover:bg-[#fafafd]"
                >
                  Give kudos
                </Link>
              </p>
            </>
          )
        : null}

      {profile.classesTaught.length > 0
        ? wrap(
            "Classes taught",
            `${profile.classesTaught.length} ${profile.classesTaught.length === 1 ? "class" : "classes"}`,
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {profile.classesTaught.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#f1f1f6] px-3 py-2"
                >
                  <span className="text-[14px] font-semibold text-[#3a3a52]">{c.title}</span>
                  {c.schedule ? (
                    <span className="shrink-0 text-[12px] text-[#9a9ab0]">{c.schedule}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        : null}

      {wrap(
        "Projects & actions",
        totalOwned === 0 ? "None visible" : `${totalOwned} active`,
        totalOwned === 0 ? (
          <p className="m-0 text-[14px] text-[#717189]">No active actions you can see.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {profile.actionsLed.length > 0 ? (
              <OwnershipGroup label="Leading" items={profile.actionsLed} />
            ) : null}
            {profile.actionsExecuting.length > 0 ? (
              <OwnershipGroup label="Executing" items={profile.actionsExecuting} />
            ) : null}
          </div>
        )
      )}

      {profile.growthSignals && profile.growthSignals.length > 0
        ? wrap(
            "Growth signals",
            "Leadership view",
            <>
              <p className="m-0 mb-3 text-[12px] text-[#9a9ab0]">
                Visible to leadership only — not shown to the member or peers.
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.growthSignals.map((signal) => {
                  const meta = GROWTH_TAG_META[signal.tag];
                  return (
                    <Pill key={signal.tag} tone={meta.tone}>
                      {meta.label}
                    </Pill>
                  );
                })}
              </div>
            </>
          )
        : null}
    </>
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
      <p className="m-0 mb-2 text-[12px] font-semibold text-[#9a9ab0]">{label}</p>
      <div className="flex flex-col gap-2">
        {people.map((person) => (
          <div key={person.id}>
            <PersonLink
              id={person.id}
              className="text-[14px] font-semibold text-[#3a3a52] no-underline hover:text-[#5a1da8]"
            >
              {person.name}
            </PersonLink>
            <span className="block text-[12px] text-[#9a9ab0]">{person.title}</span>
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
      <p className="m-0 mb-2 text-[12px] font-semibold text-[#9a9ab0]">
        {label} ({items.length})
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/actions/${item.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#f1f1f6] px-3 py-2 no-underline hover:bg-[#fafafd]"
            >
              <span className="text-[14px] font-semibold text-[#3a3a52]">{item.title}</span>
              <span className="shrink-0 text-[12px] text-[#9a9ab0]">{item.departmentName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
