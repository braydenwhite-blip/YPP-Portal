"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { cn } from "@/components/ui-v2";
import {
  initials,
  shortDate,
  type PartnerOperationsListRow,
  type PartnerOperationsStatusTone,
} from "@/lib/partners-operations";

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

function InstructorAvatars({
  instructors,
  toStaff,
}: {
  instructors: PartnerOperationsListRow["instructors"];
  toStaff: number;
}) {
  if (instructors.length === 0 && toStaff === 0) {
    return <span className="text-[13px] text-[#9a9ab0]">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center -space-x-1.5">
        {instructors.slice(0, 3).map((inst) => (
          <Link
            key={inst.id}
            href={`/admin/instructors/${inst.id}/manage`}
            onClick={(e) => e.stopPropagation()}
            title={inst.name}
            className="inline-flex size-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: avatarHue(inst.name) }}
          >
            {initials(inst.name)}
          </Link>
        ))}
      </div>
      {toStaff > 0 ? (
        <span className="text-[12px] font-semibold text-[#c0392b]">
          {toStaff} to staff
        </span>
      ) : null}
    </div>
  );
}

export function PartnersOperationsTable({ rows }: { rows: PartnerOperationsListRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-[#ebebf2] bg-white px-5 py-12 text-center text-[13px] text-[#9a9ab0] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
        No partners yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f1f1f6] bg-[#fafafd]">
              {[
                "Partner · Chapter",
                "Lead",
                "Classes",
                "Instructors",
                "Next follow-up",
                "Status",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8a8bd]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const followUpDate = row.nextFollowUpISO
                ? shortDate(row.nextFollowUpISO)
                : "—";
              const meetingDate = row.nextMeetingISO ? shortDate(row.nextMeetingISO) : null;

              return (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/partners/${row.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/partners/${row.id}`);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer border-b border-[#f4f4f8] align-top last:border-b-0 hover:bg-[#fafafd]/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#5a1da8]"
                >
                  <td className="px-4 py-4">
                    <p className="m-0 text-[15px] font-bold text-[#1c1a2e]">{row.name}</p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-[#9a9ab0]">
                      {row.chapterLabel ?? "No chapter"}
                      {row.openActionCount > 0 ? (
                        <>
                          {" · "}
                          <span className="font-semibold text-[#b45309]">
                            {row.openActionCount} open action{row.openActionCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {row.lead ? (
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: avatarHue(row.lead.name) }}
                        >
                          {initials(row.lead.name)}
                        </span>
                        <span className="text-[13px] font-semibold text-[#1c1a2e]">
                          {row.lead.name.split(" ")[0]}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[#9a9ab0]">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="m-0 text-[13px] font-bold text-[#1c1a2e]">
                      {row.classes.total} class{row.classes.total === 1 ? "" : "es"}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-[#717189]">
                      <span className="text-[#1c1a2e]">{row.classes.active} active</span>
                      {row.classes.inSetup > 0 ? (
                        <>
                          {" · "}
                          <span className="font-semibold text-[#b45309]">
                            {row.classes.inSetup} in setup
                          </span>
                        </>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <InstructorAvatars
                      instructors={row.instructors}
                      toStaff={row.instructorsToStaff}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <p
                      className={cn(
                        "m-0 text-[14px] font-bold",
                        row.followUpOverdue ? "text-[#c0392b]" : "text-[#1c1a2e]"
                      )}
                    >
                      {followUpDate}
                    </p>
                    {meetingDate ? (
                      <p className="m-0 mt-0.5 text-[12px] text-[#9a9ab0]">Mtg {meetingDate}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap",
                        STATUS_PILL[row.statusTone]
                      )}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
