"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const studentNav = [["/student", "Home"], ["/student/learning", "My Learning"], ["/student/schedule", "Schedule"], ["/student/explore", "Explore"], ["/student/forms", "Forms"], ["/student/attendance", "Attendance"], ["/student/progress", "Progress"], ["/student/certificates", "Certificates"], ["/student/recommendations", "Recommendations"], ["/student/support", "Support"], ["/student/profile", "Profile"]];
const parentNav = [["/parent", "Home"], ["/parent/students", "My Students"], ["/parent/messages", "Messages"], ["/parent/schedule", "Schedule"], ["/parent/explore", "Explore"], ["/parent/forms", "Forms"], ["/parent/attendance", "Attendance"], ["/parent/progress", "Progress"], ["/parent/certificates", "Certificates"], ["/parent/recommendations", "Recommendations"], ["/parent/support", "Support"], ["/parent/settings", "Family Settings"]];

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;
  return (
    <li>
      <Link
        href={href}
        aria-current={isActive ? "page" : undefined}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
          isActive
            ? "bg-brand-600 text-white shadow-sm"
            : "text-ink-muted hover:bg-brand-50 hover:text-brand-700"
        }`}
      >
        {label}
      </Link>
    </li>
  );
}

function Shell({ title, nav, children }: { title: string; nav: string[][]; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-surface-soft text-ink">
      <a href="#portal-content" className="sr-only focus:not-sr-only focus:absolute focus:m-4 focus:rounded-[var(--radius-control)] focus:bg-surface focus:p-3">
        Skip to portal content
      </a>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-[14px] border border-line-card bg-surface p-3 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Link
              href={nav[0][0]}
              className="text-lg font-semibold tracking-tight text-brand-800"
              style={{ fontFamily: "var(--font-lora), Georgia, serif" }}
            >
              {title}
            </Link>
            <nav aria-label={`${title} navigation`} className="overflow-x-auto pb-1">
              <ul className="m-0 flex list-none gap-1 p-0">
                {nav.map(([href, label]) => (
                  <NavItem key={href} href={href} label={label} />
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <section id="portal-content" className="space-y-6">
          {children}
        </section>
      </div>
    </main>
  );
}
export function StudentPortalShell({ children }: { children: React.ReactNode }) { return <Shell title="YPP Student Portal" nav={studentNav}>{children}</Shell>; }
export function ParentPortalShell({ children }: { children: React.ReactNode }) { return <Shell title="YPP Parent Portal" nav={parentNav}>{children}</Shell>; }
export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <div className="rounded-[14px] border border-dashed border-line bg-surface p-6"><h2 className="text-lg font-semibold text-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-muted">{body}</p>{action ? <div className="mt-4">{action}</div> : null}</div>; }
export function GuardianStudentSwitcher({ students, currentStudentId }: { students: { studentUserId: string; studentUser?: { name: string } }[]; currentStudentId?: string }) { if (students.length <= 1) return null; return <nav aria-label="Switch student" className="rounded-[14px] border border-line-card bg-surface p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Viewing student</p><div className="flex flex-wrap gap-2">{students.map((s)=><Link key={s.studentUserId} href={`/parent/students/${s.studentUserId}`} className={`rounded-[var(--radius-control)] px-3 py-2 text-sm ${currentStudentId===s.studentUserId?"bg-brand-600 text-white":"bg-idle-50 text-ink"}`}>{s.studentUser?.name ?? "Student"}</Link>)}</div></nav>; }