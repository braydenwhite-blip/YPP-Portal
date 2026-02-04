import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getChapterDashboard } from "@/lib/chapter-actions";
import Link from "next/link";

export default async function ChapterDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const data = await getChapterDashboard();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Chapter Dashboard</h1>
          <p className="subtitle">{data.chapter?.name}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalInstructors}</span>
          <span className="stat-label">Instructors</span>
          <Link href="/chapter/instructors" className="stat-link">
            View All →
          </Link>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalStudents}</span>
          <span className="stat-label">Students</span>
          <Link href="/chapter/students" className="stat-link">
            View All →
          </Link>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalMentors}</span>
          <span className="stat-label">Mentors</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.totalCourses}</span>
          <span className="stat-label">Courses</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.upcomingEvents}</span>
          <span className="stat-label">Upcoming Events</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{data.stats.openPositions}</span>
          <span className="stat-label">Open Positions</span>
          <Link href="/chapter/applicants" className="stat-link">
            View Applicants →
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Quick Actions */}
        <section className="card quick-actions">
          <h2>Quick Actions</h2>
          <div className="actions-list">
            <Link href="/chapter/updates" className="action-btn">
              📢 Send Update
            </Link>
            <Link href="/chapter/marketing" className="action-btn">
              📊 Marketing Stats
            </Link>
            <Link href="/admin/reflections" className="action-btn">
              📝 View Reflections
            </Link>
            <Link href="/mentorship/mentees" className="action-btn">
              👥 Mentee Progress
            </Link>
          </div>
        </section>

        {/* Recent Enrollments */}
        <section className="card">
          <h2>Recent Enrollments</h2>
          {data.recentEnrollments.length === 0 ? (
            <p className="empty">No recent enrollments</p>
          ) : (
            <div className="enrollments-list">
              {data.recentEnrollments.map((enrollment) => (
                <div key={enrollment.id} className="enrollment-item">
                  <div>
                    <strong>{enrollment.user.name}</strong>
                    <span className="course-name">{enrollment.course.title}</span>
                  </div>
                  <span className="date">
                    {new Date(enrollment.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Events */}
        <section className="card">
          <h2>Upcoming Events</h2>
          {data.chapter?.events.length === 0 ? (
            <p className="empty">No upcoming events</p>
          ) : (
            <div className="events-list">
              {data.chapter?.events.map((event) => (
                <div key={event.id} className="event-item">
                  <div className="event-date">
                    <span className="day">
                      {new Date(event.startDate).getDate()}
                    </span>
                    <span className="month">
                      {new Date(event.startDate).toLocaleDateString("en-US", {
                        month: "short",
                      })}
                    </span>
                  </div>
                  <div className="event-details">
                    <strong>{event.title}</strong>
                    <span className="event-type">{event.eventType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Active Courses */}
        <section className="card">
          <h2>Active Courses</h2>
          {data.chapter?.courses.length === 0 ? (
            <p className="empty">No active courses</p>
          ) : (
            <div className="courses-list">
              {data.chapter?.courses.slice(0, 5).map((course) => (
                <div key={course.id} className="course-item">
                  <div>
                    <strong>{course.title}</strong>
                    {course.leadInstructor && (
                      <span className="instructor">
                        Led by {course.leadInstructor.name}
                      </span>
                    )}
                  </div>
                  <span className="enrollment-count">
                    {course.enrollments.length} enrolled
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Announcements */}
        <section className="card">
          <h2>Recent Announcements</h2>
          {data.chapter?.announcements.length === 0 ? (
            <p className="empty">No announcements</p>
          ) : (
            <div className="announcements-list">
              {data.chapter?.announcements.map((ann) => (
                <div key={ann.id} className="announcement-item">
                  <strong>{ann.title}</strong>
                  <p>{ann.content.slice(0, 100)}...</p>
                  <span className="date">
                    {new Date(ann.publishedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Open Positions */}
        <section className="card">
          <h2>Open Positions</h2>
          {data.chapter?.positions.length === 0 ? (
            <p className="empty">No open positions</p>
          ) : (
            <div className="positions-list">
              {data.chapter?.positions.map((pos) => (
                <div key={pos.id} className="position-item">
                  <div>
                    <strong>{pos.title}</strong>
                    <span className="type">{pos.type}</span>
                  </div>
                  <span className="applications">
                    {pos._count.applications} applications
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .page-header {
          margin-bottom: 2rem;
        }
        .subtitle {
          color: var(--muted);
          margin: 0;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          padding: 1.5rem;
          text-align: center;
        }
        .stat-value {
          display: block;
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--primary);
        }
        .stat-label {
          display: block;
          color: var(--muted);
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .stat-link {
          font-size: 0.75rem;
          color: var(--primary);
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .card {
          padding: 1.5rem;
        }
        .card h2 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
        .quick-actions {
          grid-column: span 2;
        }
        .actions-list {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: var(--background);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          text-decoration: none;
          color: inherit;
          font-weight: 500;
          transition: all 0.2s;
        }
        .action-btn:hover {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .enrollments-list,
        .events-list,
        .courses-list,
        .announcements-list,
        .positions-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .enrollment-item,
        .course-item,
        .position-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .enrollment-item strong,
        .course-item strong,
        .position-item strong {
          display: block;
        }
        .course-name,
        .instructor,
        .type {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .date,
        .enrollment-count,
        .applications {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .event-item {
          display: flex;
          gap: 1rem;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .event-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem;
          background: var(--primary);
          color: white;
          border-radius: 0.25rem;
          min-width: 50px;
        }
        .event-date .day {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1;
        }
        .event-date .month {
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        .event-details strong {
          display: block;
        }
        .event-type {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .announcement-item {
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .announcement-item strong {
          display: block;
          margin-bottom: 0.25rem;
        }
        .announcement-item p {
          margin: 0 0 0.5rem;
          font-size: 0.875rem;
          color: var(--muted);
        }
        @media (max-width: 768px) {
          .quick-actions {
            grid-column: span 1;
          }
        }
      `}</style>
    </main>
  );
}
