import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireChapterCalendarViewer } from "@/lib/chapter-calendar-auth";
import { getChapterCalendarEntries } from "@/lib/chapter-calendar";
import {
  rotateChapterCalendarFeedTokenAction,
  toggleChapterCalendarSubscriptionAction,
} from "@/lib/chapter-calendar-actions";
import { rsvpToEvent } from "@/lib/calendar-actions";

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatEntryDate(startDate: string, endDate: string, allDay: boolean) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (allDay) {
    return start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} · ${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default async function MyChapterCalendarPage() {
  const viewer = await requireChapterCalendarViewer();
  const chapter = await prisma.chapter.findUnique({
    where: { id: viewer.chapterId },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      region: true,
      calendarDescription: true,
      publicProfileEnabled: true,
    },
  });

  if (!chapter) {
    redirect("/my-chapter");
  }

  const subscription = await prisma.chapterCalendarSubscription.findUnique({
    where: {
      chapterId_userId: {
        chapterId: chapter.id,
        userId: viewer.user.id,
      },
    },
  });

  const entries = await getChapterCalendarEntries({
    chapterId: chapter.id,
    start: addDays(new Date(), -7),
    end: addDays(new Date(), 120),
    includeInternal: true,
    userId: viewer.user.id,
    subscribedChapterIds: subscription ? [chapter.id] : [],
  });

  const upcomingEntries = entries.filter((entry) => new Date(entry.endDate) >= new Date());
  const manualEvents = upcomingEntries.filter((entry) => entry.source === "EVENT");
  const feedUrl = subscription
    ? `/api/chapter-calendar/feed?chapterId=${chapter.id}&token=${subscription.feedToken}`
    : null;
  const publicFeedUrl = chapter.publicProfileEnabled
    ? `/api/chapter-calendar/feed?slug=${chapter.slug || chapter.name.toLowerCase().replace(/\s+/g, "-")}&public=1`
    : null;

  return (
    <main className="main-content">
      <div className="topbar">
        <div>
          <p className="badge">My Chapter Calendar</p>
          <h1 className="page-title">{chapter.name}</h1>
          <p className="page-subtitle">
            Keep one eye on your chapter&apos;s shared schedule and one eye on your own RSVP choices.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/my-chapter" className="button outline small">
            Back to My Chapter
          </Link>
          {viewer.isAdmin || viewer.isChapterLead ? (
            <Link href="/chapter/calendar" className="button small">
              Manage Chapter Calendar
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 24 }}>
        <section className="card">
          <h3 style={{ marginTop: 0 }}>What this page does</h3>
          <p style={{ color: "var(--text-secondary)" }}>
            This is the shared calendar for your chapter. It mixes chapter events, class sessions,
            local milestones, and rollout deadlines into one timeline so you do not have to hunt in
            five different places.
          </p>
          <p style={{ color: "var(--text-secondary)", marginBottom: 0 }}>
            {chapter.calendarDescription ||
              "Use the subscription toggle if you want update notifications when your chapter calendar changes."}
          </p>
        </section>

        <section className="card">
          <div className="grid two" style={{ gap: 12 }}>
            <div>
              <div className="kpi">{upcomingEntries.length}</div>
              <div className="kpi-label">Upcoming items</div>
            </div>
            <div>
              <div className="kpi">{manualEvents.length}</div>
              <div className="kpi-label">Chapter events</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={toggleChapterCalendarSubscriptionAction}>
              <input type="hidden" name="chapterId" value={chapter.id} />
              <button type="submit" className="button outline small">
                {subscription ? "Unsubscribe from updates" : "Subscribe to chapter updates"}
              </button>
            </form>
            {feedUrl ? (
              <a href={feedUrl} className="button outline small">
                Private iCal Feed
              </a>
            ) : null}
            {subscription ? (
              <form action={rotateChapterCalendarFeedTokenAction}>
                <input type="hidden" name="chapterId" value={chapter.id} />
                <button type="submit" className="button outline small">
                  Rotate feed token
                </button>
              </form>
            ) : null}
            {publicFeedUrl ? (
              <a href={publicFeedUrl} className="button outline small">
                Public iCal Feed
              </a>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Your chapter timeline</h3>
        {upcomingEntries.length === 0 ? (
          <p className="empty">No chapter calendar items are scheduled yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {upcomingEntries.map((entry) => (
              <article
                key={entry.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: 16,
                  background: entry.isCancelled ? "rgba(248, 250, 252, 0.8)" : "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <span className="pill" style={{ background: `${entry.eventTypeColor}22`, color: entry.eventTypeColor }}>
                        {entry.eventTypeLabel}
                      </span>
                      <span className="pill">{entry.visibility}</span>
                      {entry.isSubscribed ? <span className="pill">Subscribed</span> : null}
                      {entry.userRsvpStatus ? <span className="pill">RSVP {entry.userRsvpStatus}</span> : null}
                      {entry.isCancelled ? (
                        <span className="pill" style={{ background: "#fee2e2", color: "#991b1b" }}>
                          Cancelled
                        </span>
                      ) : null}
                    </div>
                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>{entry.title}</h3>
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
                      {formatEntryDate(entry.startDate, entry.endDate, entry.allDay)}
                    </p>
                    {entry.description ? (
                      <p style={{ margin: "10px 0 0", color: "var(--text-secondary)" }}>{entry.description}</p>
                    ) : null}
                    {entry.location ? (
                      <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                        Location: {entry.location}
                      </p>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                    {entry.meetingUrl && !entry.isCancelled ? (
                      <a href={entry.meetingUrl} className="button small" target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    ) : null}
                    {entry.eventId ? (
                      <a href={`/api/calendar?eventId=${entry.eventId}`} className="button small outline">
                        Add to calendar
                      </a>
                    ) : null}
                  </div>
                </div>

                {entry.eventId && !entry.isCancelled ? (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>RSVP</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => (
                        <form key={status} action={rsvpToEvent}>
                          <input type="hidden" name="eventId" value={entry.eventId ?? ""} />
                          <input type="hidden" name="status" value={status} />
                          <button
                            type="submit"
                            className={`button small ${entry.userRsvpStatus === status ? "" : "outline"}`}
                          >
                            {status === "GOING" ? "Going" : status === "MAYBE" ? "Maybe" : "Can't go"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {(chapter.city || chapter.region) && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Chapter snapshot</h3>
          <p style={{ marginBottom: 0, color: "var(--text-secondary)" }}>
            {chapter.city ? chapter.city : "Unknown city"}
            {chapter.region ? `, ${chapter.region}` : ""}
            {chapter.publicProfileEnabled ? " · Public chapter profile is live." : " · Public chapter profile is private."}
          </p>
        </section>
      )}
    </main>
  );
}
