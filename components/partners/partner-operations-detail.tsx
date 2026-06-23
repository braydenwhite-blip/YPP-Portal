import Link from "next/link";

import { ButtonLink, cn } from "@/components/ui-v2";
import {
  initials,
  shortDate,
  type PartnerClassCard,
  type PartnerOperationsDetail,
  type PartnerOperationsStatusTone,
} from "@/lib/partners-operations-shared";

const AVATAR_HUES = ["#e07b2d", "#5a1da8", "#0891b2", "#0e7c52", "#7c3aed", "#1d6fd6"];

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_HUES[Math.abs(hash) % AVATAR_HUES.length];
}

const STATUS_PILL: Record<PartnerOperationsStatusTone, string> = {
  success: "bg-[#ecfdf5] text-[#047857]",
  warning: "bg-[#fdf8eb] text-[#8a5d00]",
  danger: "bg-[#fdecea] text-[#c0392b]",
  neutral: "bg-[#f4f4f8] text-[#5c5c74]",
};

function ClassCard({ card }: { card: PartnerClassCard }) {
  return (
    <article className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={card.href}
            className="text-[15px] font-bold text-[#1c1a2e] no-underline hover:text-[#5a1da8]"
          >
            {card.title}
          </Link>
          <p className="m-0 mt-0.5 text-[12.5px] text-[#717189]">{card.scheduleLabel}</p>
          <p className="m-0 mt-0.5 text-[12px] text-[#9a9ab0]">{card.enrollmentLabel}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            card.statusTone === "success"
              ? "bg-[#ecfdf5] text-[#047857]"
              : "bg-[#fdf8eb] text-[#8a5d00]"
          )}
        >
          {card.statusLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]">
            Instructor
          </p>
          {card.instructor ? (
            <Link
              href={`/admin/instructors/${card.instructor.id}/manage`}
              className="mt-1 flex items-center gap-2 no-underline"
            >
              <span
                aria-hidden
                className="inline-flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: avatarHue(card.instructor.name) }}
              >
                {initials(card.instructor.name)}
              </span>
              <span className="text-[13px] font-semibold text-[#1c1a2e]">
                {card.instructor.name.split(" ")[0]}
              </span>
            </Link>
          ) : (
            <p className="m-0 mt-1 text-[13px] text-[#9a9ab0]">Unassigned</p>
          )}
        </div>
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]">
            Curriculum
          </p>
          <p className="m-0 mt-1 text-[13px] font-semibold text-[#1c1a2e]">
            {card.curriculumLead?.split(" ")[0] ?? "—"}
          </p>
        </div>
      </div>

      {card.missingInstructor ? (
        <p className="m-0 mt-3 rounded-[8px] bg-[#fdf8eb] px-3 py-2 text-[12.5px] font-medium text-[#8a5d00]">
          Missing instructor — assign before fall launch.
        </p>
      ) : null}
    </article>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[#ebebf2] bg-white p-4 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PartnerOperationsDetailView({
  partner,
  canManage,
}: {
  partner: PartnerOperationsDetail;
  canManage: boolean;
}) {
  const subtitle = [partner.chapterLabel, `${partner.classCount} classes`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[26px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
              {partner.name}
            </h1>
            <p className="m-0 mt-1 text-[13.5px] text-[#717189]">{subtitle}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-[12px] font-semibold",
              STATUS_PILL[partner.statusTone]
            )}
          >
            {partner.statusLabel}
          </span>
        </header>

        <section className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
              Classes with this partner
            </h2>
            <span className="text-[12px] font-semibold text-[#717189]">
              {partner.classCount} total
            </span>
          </div>
          {partner.classes.length === 0 ? (
            <p className="m-0 text-[13px] text-[#9a9ab0]">No classes linked yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {partner.classes.map((card) => (
                <ClassCard key={card.id} card={card} />
              ))}
            </div>
          )}
          <Link
            href="/people/classes"
            className="mt-4 inline-block text-[13px] font-semibold text-[#5a1da8] no-underline hover:underline"
          >
            + Create class with this partner
          </Link>
        </section>

        <section className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
              Open actions
            </h2>
            {canManage ? (
              <Link
                href={`/actions/new?relatedType=PARTNER&relatedId=${partner.id}`}
                className="text-[12px] font-semibold text-[#5a1da8] no-underline hover:underline"
              >
                + Add action
              </Link>
            ) : null}
          </div>
          {partner.openActions.length === 0 ? (
            <p className="m-0 text-[13px] text-[#9a9ab0]">No open actions.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {partner.openActions.map((action) => (
                <li key={action.id}>
                  <Link
                    href={action.href}
                    className="flex items-center justify-between gap-3 rounded-[10px] border border-[#f1f1f6] px-3 py-2.5 no-underline hover:bg-[#fafafd]"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[13px] font-semibold text-[#1c1a2e]">
                        {action.title}
                      </p>
                      <p className="m-0 text-[12px] text-[#9a9ab0]">{action.dateRangeLabel}</p>
                    </div>
                    <span
                      aria-hidden
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f4f4f8] text-[10px] font-bold text-[#5c5c74]"
                    >
                      {action.ownerInitials}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[14px] border border-[#ebebf2] bg-white p-5 shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
          <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#9a9ab0]">
            Follow-up history
          </h2>
          {partner.followUpHistory.length === 0 ? (
            <p className="m-0 mt-3 text-[13px] text-[#9a9ab0]">No notes yet.</p>
          ) : (
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {partner.followUpHistory.map((item) => (
                <li key={item.id} className="text-[13px] leading-relaxed text-[#3a3a52]">
                  <span className="font-semibold text-[#717189]">{item.dateLabel}</span>{" "}
                  {item.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        <SidebarSection title="Relationship lead">
          {partner.lead ? (
            <>
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="inline-flex size-9 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ background: avatarHue(partner.lead.name) }}
                >
                  {initials(partner.lead.name)}
                </span>
                <div>
                  <p className="m-0 text-[14px] font-bold text-[#1c1a2e]">{partner.lead.name}</p>
                  <p className="m-0 text-[12px] text-[#9a9ab0]">Owns this partner</p>
                </div>
              </div>
            </>
          ) : (
            <p className="m-0 text-[13px] text-[#9a9ab0]">No lead assigned.</p>
          )}
        </SidebarSection>

        <SidebarSection title="Next meeting">
          <p className="m-0 text-[22px] font-bold text-[#1c1a2e]">
            {partner.nextMeetingISO ? shortDate(partner.nextMeetingISO) : "—"}
          </p>
          <ButtonLink
            href={`/actions/meetings?new=1&relatedType=PARTNER&relatedId=${partner.id}`}
            variant="secondary"
            size="sm"
            className="mt-3 w-full border-[#dcd4f5] bg-[#f5f0ff] text-[#5a1da8] hover:bg-[#ede8fb]"
          >
            Schedule meeting
          </ButtonLink>
        </SidebarSection>

        {partner.notes ? (
          <SidebarSection title="Notes">
            <p className="m-0 text-[13px] leading-relaxed text-[#5c5c74]">{partner.notes}</p>
          </SidebarSection>
        ) : null}

        <SidebarSection title="Files & links">
          {partner.filesAndLinks.length === 0 ? (
            <p className="m-0 text-[13px] text-[#9a9ab0]">Nothing attached yet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {partner.filesAndLinks.map((file) => (
                <li key={file.id} className="text-[13px] font-medium text-[#5a1da8]">
                  📎 {file.label}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <Link
              href={`/admin/partners/${partner.id}#relationship-ops`}
              className="mt-3 inline-block text-[12px] font-semibold text-[#5a1da8] no-underline hover:underline"
            >
              + Attach file or link
            </Link>
          ) : null}
        </SidebarSection>

        <SidebarSection title="Partner meetings">
          {partner.partnerMeetings.length === 0 ? (
            <p className="m-0 text-[13px] text-[#9a9ab0]">No meetings on file.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {partner.partnerMeetings.map((m) => (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    className="block text-[13px] no-underline hover:text-[#5a1da8]"
                  >
                    <span className="font-semibold text-[#1c1a2e]">{m.title}</span>
                    <span className="text-[#9a9ab0]"> · {m.dateLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>

        {canManage ? (
          <ButtonLink
            href={`/admin/partners/${partner.id}`}
            variant="ghost"
            size="sm"
            className="w-full text-[#717189]"
          >
            Open admin profile
          </ButtonLink>
        ) : null}
      </aside>
    </div>
  );
}
