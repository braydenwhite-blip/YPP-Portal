import Link from "next/link";

import { ButtonLink } from "@/components/ui-v2";
import type { InstructorTeachingWorkspace } from "@/lib/classes/instructor-workspace";

export type InstructorHomeNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

function greeting(name: string) {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${salutation}, ${name}.` : `${salutation}.`;
}

function shortWhen(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function notificationWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function InstructorTeachingHome({
  name,
  workspace,
  unreadNotifications,
  recentNotifications,
}: {
  name: string;
  workspace: InstructorTeachingWorkspace;
  unreadNotifications: number;
  recentNotifications: InstructorHomeNotification[];
}) {
  const classes = workspace.activeClasses;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-7 sm:px-6 lg:pt-10">
      <header>
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.09em] text-brand-700">
          Home
        </p>
        <h1 className="m-0 mt-2 text-[26px] font-semibold tracking-[-0.03em] text-ink sm:text-[30px]">
          {greeting(name)}
        </h1>
      </header>

      <section className="mt-8" aria-labelledby="instructor-classes-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="instructor-classes-heading" className="m-0 text-[17px] font-semibold text-ink">
            Your classes
          </h2>
          <Link
            href="/instructor/classes"
            className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {classes.length > 0 ? (
          <ul className="m-0 mt-3 list-none divide-y divide-line-card overflow-hidden rounded-[14px] border border-line-card bg-surface p-0">
            {classes.map((teachingClass) => {
              const next = teachingClass.nextSession;
              return (
                <li key={teachingClass.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[14.5px] font-semibold text-ink">
                      {teachingClass.title}
                    </p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                      {next
                        ? `Next: ${shortWhen(next.state.startsAt, teachingClass.timezone)}`
                        : teachingClass.scheduleLabel}
                    </p>
                  </div>
                  <ButtonLink
                    href={`/instructor/classes/${teachingClass.id}`}
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                  >
                    Open
                  </ButtonLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="m-0 mt-3 rounded-[14px] border border-line-card bg-surface px-4 py-5 text-[13.5px] text-ink-muted">
            No classes assigned yet. When YPP adds you to a class, it will show up here.
          </p>
        )}
      </section>

      <section className="mt-10" aria-labelledby="instructor-updates-heading">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="instructor-updates-heading" className="m-0 text-[17px] font-semibold text-ink">
            Updates
          </h2>
          {unreadNotifications > 0 ? (
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[12px] font-semibold text-brand-800">
              {unreadNotifications > 99 ? "99+" : unreadNotifications} new
            </span>
          ) : null}
        </div>

        {recentNotifications.length > 0 ? (
          <ul className="m-0 mt-3 list-none divide-y divide-line-card overflow-hidden rounded-[14px] border border-line-card bg-surface p-0">
            {recentNotifications.map((notification) => (
              <li key={notification.id}>
                <Link
                  href={notification.link || "/notifications"}
                  className="flex items-start justify-between gap-4 p-4 no-underline transition-colors hover:bg-surface-soft"
                >
                  <div className="min-w-0">
                    <p
                      className={`m-0 text-[14px] ${
                        notification.isRead ? "font-medium text-ink" : "font-semibold text-ink"
                      }`}
                    >
                      {!notification.isRead ? (
                        <span
                          className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand-600 align-middle"
                          aria-hidden
                        />
                      ) : null}
                      {notification.title}
                    </p>
                    {notification.body ? (
                      <p className="m-0 mt-1 text-[12.5px] leading-5 text-ink-muted">
                        {truncate(notification.body, 110)}
                      </p>
                    ) : null}
                  </div>
                  <time
                    className="shrink-0 text-[11.5px] text-ink-muted"
                    dateTime={notification.createdAt}
                  >
                    {notificationWhen(notification.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-3 rounded-[14px] border border-line-card bg-surface px-4 py-5 text-[13.5px] text-ink-muted">
            No updates yet.
          </p>
        )}

        <Link
          href="/notifications"
          className="mt-3 inline-flex text-[13px] font-semibold text-brand-700 hover:underline"
        >
          Notification center
        </Link>
      </section>
    </main>
  );
}
