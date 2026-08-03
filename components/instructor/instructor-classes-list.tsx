import Link from "next/link";

import { EmptyStateV2 } from "@/components/ui-v2";
import type {
  InstructorTeachingWorkspace,
  TeachingClass,
} from "@/lib/classes/instructor-workspace";

/** Stable Classroom-style cover colors when a class has no theme set yet. */
const COVER_PALETTE = [
  { from: "#1a73e8", to: "#174ea6" },
  { from: "#0d904f", to: "#0b8043" },
  { from: "#d93025", to: "#a50e0e" },
  { from: "#e37400", to: "#b06000" },
  { from: "#9334e6", to: "#681da8" },
  { from: "#00786a", to: "#005f56" },
  { from: "#e52592", to: "#c2185b" },
  { from: "#5f6368", to: "#3c4043" },
] as const;

function darkenHex(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = Math.max(0, Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function coverForClass(teachingClass: TeachingClass) {
  const theme =
    teachingClass.themeColor && /^#[0-9a-fA-F]{6}$/.test(teachingClass.themeColor)
      ? teachingClass.themeColor.toLowerCase()
      : null;
  if (theme) {
    // Match class-home banner color; slight shade for card depth.
    return { from: theme, to: darkenHex(theme, 0.16) };
  }
  let hash = 0;
  for (let i = 0; i < teachingClass.id.length; i += 1) {
    hash = (hash * 31 + teachingClass.id.charCodeAt(i)) >>> 0;
  }
  return COVER_PALETTE[hash % COVER_PALETTE.length]!;
}
function nextSessionLine(teachingClass: TeachingClass) {
  if (!teachingClass.nextSession) return "No upcoming session";
  const session = teachingClass.nextSession;
  const when = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: teachingClass.timezone,
    timeZoneName: "short",
  }).format(session.state.startsAt);
  return `${when} · ${session.topic}`;
}

function needsAttention(teachingClass: TeachingClass) {
  return (
    teachingClass.primaryAction != null ||
    teachingClass.leadershipRequests.length > 0 ||
    teachingClass.studentAttention.length > 0
  );
}

export function InstructorClassesList({ workspace }: { workspace: InstructorTeachingWorkspace }) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8f9fa]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-[28px] font-normal tracking-[-0.02em] text-[#202124] sm:text-[32px]">
              Classes
            </h1>
            <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
              Your teaching classes — open one to run sessions, roster, and materials.
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-[13.5px] font-medium text-brand-700 no-underline hover:underline"
          >
            Home
          </Link>
        </header>

        {workspace.activeClasses.length === 0 ? (
          <EmptyStateV2
            title="No classes yet"
            body="A class shows up here after you are assigned as lead instructor or accept a teaching assignment."
          />
        ) : (
          <section
            aria-label="Active classes"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {workspace.activeClasses.map((teachingClass) => (
              <ClassCard key={teachingClass.id} teachingClass={teachingClass} />
            ))}
          </section>
        )}

        {workspace.completedClasses.length > 0 ? (
          <section className="mt-12" aria-label="Completed classes">
            <h2 className="m-0 mb-4 text-[14px] font-medium uppercase tracking-[0.06em] text-[#5f6368]">
              Completed ({workspace.completedClasses.length})
            </h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {workspace.completedClasses.map((teachingClass) => (
                <ClassCard key={teachingClass.id} teachingClass={teachingClass} muted />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ClassCard({
  teachingClass,
  muted = false,
}: {
  teachingClass: TeachingClass;
  muted?: boolean;
}) {
  const cover = coverForClass(teachingClass);
  const href = teachingClass.primaryAction?.href ?? `/instructor/classes/${teachingClass.id}`;
  const attention = !muted && needsAttention(teachingClass);
  const studentCount = teachingClass.roster.length;

  return (
    <Link
      href={href}
      className={[
        "group flex flex-col overflow-hidden rounded-2xl border border-[#dadce0] bg-white no-underline shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition-[box-shadow,transform] duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(60,64,67,0.14)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        muted ? "opacity-80" : "",
      ].join(" ")}
    >
      <div
        className="relative h-[112px] px-4 pb-3 pt-4 text-white"
        style={{
          background: `linear-gradient(135deg, ${cover.from} 0%, ${cover.to} 100%)`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 20%, #fff 0, transparent 42%), radial-gradient(circle at 10% 90%, #fff 0, transparent 36%)",
          }}
        />
        <h2 className="relative m-0 line-clamp-2 text-[18px] font-medium leading-snug tracking-[-0.01em]">
          {teachingClass.title}
        </h2>
        <p className="relative m-0 mt-1.5 line-clamp-1 text-[12.5px] text-white/85">
          {teachingClass.scheduleLabel || teachingClass.deliveryMode.replaceAll("_", " ")}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-3.5">
        <p className="m-0 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-[#3c4043]">
          {nextSessionLine(teachingClass)}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#f1f3f4] pt-3">
          <span className="text-[12.5px] text-[#5f6368]">
            {studentCount === 0
              ? "No students yet"
              : `${studentCount} student${studentCount === 1 ? "" : "s"}`}
          </span>
          {attention ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef7e0] px-2 py-0.5 text-[11.5px] font-medium text-[#b06000]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#e37400]" />
              Needs attention
            </span>
          ) : muted ? (
            <span className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[#80868b]">
              Done
            </span>
          ) : (
            <span className="text-[12.5px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
