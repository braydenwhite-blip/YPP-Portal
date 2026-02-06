"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  eventType: string;
  startDate: string;
  endDate: string;
  location: string | null;
  meetingUrl: string | null;
  chapter: { name: string } | null;
}

interface CalendarViewProps {
  initialEvents?: CalendarEvent[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_TYPE_COLORS: Record<string, string> = {
  SHOWCASE: "#8b5cf6",
  FESTIVAL: "#ec4899",
  COMPETITION: "#f59e0b",
  WORKSHOP: "#3b82f6",
  ALUMNI_EVENT: "#10b981",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isEventOnDay(event: CalendarEvent, day: Date): boolean {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  return start <= dayEnd && end >= dayStart;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function CalendarView({ initialEvents = [] }: CalendarViewProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<"month" | "list">("month");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      try {
        const start = new Date(currentYear, currentMonth, 1).toISOString();
        const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
        const res = await fetch(`/api/events?start=${start}&end=${end}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch {
        // Use initial events on error
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [currentYear, currentMonth]);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  }

  function goToToday() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDate(today);
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Build calendar grid
  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(currentYear, currentMonth, d));
  }

  const selectedDayEvents = selectedDate
    ? events.filter((e) => isEventOnDay(e, selectedDate))
    : [];

  // Sort events for list view
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={prevMonth} className="calendar-nav-btn" aria-label="Previous month">
            &#8249;
          </button>
          <h2 className="calendar-title">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <button onClick={nextMonth} className="calendar-nav-btn" aria-label="Next month">
            &#8250;
          </button>
        </div>
        <div className="calendar-actions">
          <button onClick={goToToday} className="button small outline">
            Today
          </button>
          <div className="calendar-view-toggle">
            <button
              onClick={() => setView("month")}
              className={`calendar-toggle-btn ${view === "month" ? "active" : ""}`}
            >
              Month
            </button>
            <button
              onClick={() => setView("list")}
              className={`calendar-toggle-btn ${view === "list" ? "active" : ""}`}
            >
              List
            </button>
          </div>
          <a href="/api/calendar" className="button small outline" download>
            Export iCal
          </a>
        </div>
      </div>

      {loading && <div className="calendar-loading">Loading events...</div>}

      {view === "month" ? (
        <div className="calendar-month-view">
          {/* Day headers */}
          <div className="calendar-grid calendar-day-headers">
            {DAYS.map((day) => (
              <div key={day} className="calendar-day-header">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="calendar-grid calendar-cells">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="calendar-cell empty" />;
              }

              const dayEvents = events.filter((e) => isEventOnDay(e, day));
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

              return (
                <div
                  key={day.getDate()}
                  className={`calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayEvents.length > 0 ? "has-events" : ""}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className="calendar-date-number">{day.getDate()}</span>
                  <div className="calendar-cell-events">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="calendar-event-dot"
                        style={{
                          backgroundColor: EVENT_TYPE_COLORS[event.eventType] || "#8b5cf6",
                        }}
                        title={event.title}
                      >
                        <span className="calendar-event-dot-text">{event.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="calendar-more">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDate && (
            <div className="calendar-detail-panel">
              <h3 className="calendar-detail-title">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              {selectedDayEvents.length === 0 ? (
                <p className="empty">No events on this day.</p>
              ) : (
                <div className="calendar-event-list">
                  {selectedDayEvents.map((event) => (
                    <div key={event.id} className="calendar-event-card">
                      <div
                        className="calendar-event-stripe"
                        style={{
                          backgroundColor: EVENT_TYPE_COLORS[event.eventType] || "#8b5cf6",
                        }}
                      />
                      <div className="calendar-event-info">
                        <strong>{event.title}</strong>
                        <div className="calendar-event-meta">
                          <span className="pill pill-small pill-purple">
                            {event.eventType.replace("_", " ")}
                          </span>
                          <span>
                            {formatTime(event.startDate)} &ndash; {formatTime(event.endDate)}
                          </span>
                        </div>
                        {event.location && (
                          <p className="calendar-event-location">{event.location}</p>
                        )}
                        {event.chapter && (
                          <p className="calendar-event-chapter">{event.chapter.name}</p>
                        )}
                        <p className="calendar-event-desc">{event.description}</p>
                        <div className="calendar-event-actions">
                          {event.meetingUrl && (
                            <a
                              href={event.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="button small"
                            >
                              Join Meeting
                            </a>
                          )}
                          <a
                            href={`/api/calendar?eventId=${event.id}`}
                            download
                            className="button small outline"
                          >
                            Add to Calendar
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="calendar-list-view">
          {sortedEvents.length === 0 ? (
            <p className="empty">No events this month.</p>
          ) : (
            <div className="calendar-event-list">
              {sortedEvents.map((event) => {
                const start = new Date(event.startDate);
                return (
                  <div key={event.id} className="calendar-event-card">
                    <div
                      className="calendar-event-stripe"
                      style={{
                        backgroundColor: EVENT_TYPE_COLORS[event.eventType] || "#8b5cf6",
                      }}
                    />
                    <div className="calendar-list-date">
                      <span className="calendar-list-day">{start.getDate()}</span>
                      <span className="calendar-list-month">
                        {MONTHS[start.getMonth()].slice(0, 3)}
                      </span>
                    </div>
                    <div className="calendar-event-info">
                      <strong>{event.title}</strong>
                      <div className="calendar-event-meta">
                        <span className="pill pill-small pill-purple">
                          {event.eventType.replace("_", " ")}
                        </span>
                        <span>
                          {formatTime(event.startDate)} &ndash; {formatTime(event.endDate)}
                        </span>
                      </div>
                      {event.location && (
                        <p className="calendar-event-location">{event.location}</p>
                      )}
                      <p className="calendar-event-desc">{event.description}</p>
                    </div>
                    <div className="calendar-event-actions" style={{ flexShrink: 0 }}>
                      {event.meetingUrl && (
                        <a
                          href={event.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="button small"
                        >
                          Join
                        </a>
                      )}
                      <a
                        href={`/api/calendar?eventId=${event.id}`}
                        download
                        className="button small outline"
                      >
                        iCal
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="calendar-legend">
        {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="calendar-legend-item">
            <span className="calendar-legend-dot" style={{ backgroundColor: color }} />
            <span>{type.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
