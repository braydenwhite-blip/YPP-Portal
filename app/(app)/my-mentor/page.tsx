import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyStudentMentor } from "@/lib/student-actions";

export default async function MyMentorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const mentorship = await getMyStudentMentor();

  if (!mentorship) {
    return (
      <main className="main-content">
        <h1>My Mentor</h1>
        <div className="card no-mentor">
          <div className="icon">👤</div>
          <h2>No Mentor Assigned</h2>
          <p>
            You don't currently have a student mentor assigned. If you believe
            you should have a mentor, please contact your chapter president or
            administrator.
          </p>
        </div>

        <style jsx>{`
          .no-mentor {
            text-align: center;
            padding: 3rem;
            max-width: 500px;
            margin: 2rem auto;
          }
          .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .no-mentor h2 {
            margin: 0 0 1rem;
          }
          .no-mentor p {
            color: var(--muted);
            margin: 0;
          }
        `}</style>
      </main>
    );
  }

  const mentor = mentorship.mentor;

  return (
    <main className="main-content">
      <h1>My Mentor</h1>

      <div className="mentor-grid">
        {/* Mentor Profile */}
        <section className="card mentor-profile">
          <div className="mentor-header">
            <div className="avatar">
              {mentor.profile?.avatarUrl ? (
                <img src={mentor.profile.avatarUrl} alt={mentor.name} />
              ) : (
                mentor.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="mentor-info">
              <h2>{mentor.name}</h2>
              <span className="role">Your Student Mentor</span>
            </div>
          </div>

          {mentor.profile?.bio && (
            <div className="bio">
              <h3>About</h3>
              <p>{mentor.profile.bio}</p>
            </div>
          )}

          <div className="contact-section">
            <h3>Contact Information</h3>
            <div className="contact-item">
              <span className="icon">📧</span>
              <a href={`mailto:${mentor.email}`}>{mentor.email}</a>
            </div>
            {mentor.phone && (
              <div className="contact-item">
                <span className="icon">📱</span>
                <a href={`tel:${mentor.phone}`}>{mentor.phone}</a>
              </div>
            )}
          </div>

          <div className="actions">
            <a href={`mailto:${mentor.email}`} className="btn btn-primary">
              Send Email
            </a>
          </div>
        </section>

        {/* Mentorship Details */}
        <section className="card mentorship-details">
          <h3>Mentorship Details</h3>
          <div className="detail-item">
            <span className="label">Status</span>
            <span className="status status-active">{mentorship.status}</span>
          </div>
          <div className="detail-item">
            <span className="label">Started</span>
            <span className="value">
              {new Date(mentorship.startDate).toLocaleDateString()}
            </span>
          </div>
          {mentorship.notes && (
            <div className="notes">
              <span className="label">Notes</span>
              <p>{mentorship.notes}</p>
            </div>
          )}
        </section>

        {/* Recent Check-ins */}
        <section className="card check-ins">
          <h3>Recent Check-ins</h3>
          {mentorship.checkIns.length === 0 ? (
            <p className="empty">No check-ins recorded yet.</p>
          ) : (
            <div className="check-ins-list">
              {mentorship.checkIns.map((checkIn) => (
                <div key={checkIn.id} className="check-in-item">
                  <div className="check-in-header">
                    <span className="date">
                      {new Date(checkIn.createdAt).toLocaleDateString()}
                    </span>
                    {checkIn.rating && (
                      <span className="rating">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={n <= checkIn.rating! ? "star filled" : "star"}
                          >
                            ★
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <p className="notes">{checkIn.notes}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .mentor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .mentor-grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          padding: 1.5rem;
        }
        .mentor-profile {
          grid-row: span 2;
        }
        .mentor-header {
          display: flex;
          gap: 1.5rem;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 700;
          overflow: hidden;
        }
        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .mentor-info h2 {
          margin: 0;
        }
        .role {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .bio {
          margin-bottom: 1.5rem;
        }
        .bio h3,
        .contact-section h3 {
          margin: 0 0 0.75rem;
          font-size: 1rem;
        }
        .bio p {
          margin: 0;
          color: var(--muted);
        }
        .contact-section {
          margin-bottom: 1.5rem;
        }
        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
        }
        .contact-item .icon {
          font-size: 1.25rem;
        }
        .contact-item a {
          color: var(--primary);
          text-decoration: none;
        }
        .contact-item a:hover {
          text-decoration: underline;
        }
        .actions {
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .mentorship-details h3,
        .check-ins h3 {
          margin: 0 0 1rem;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
        }
        .detail-item:last-child {
          border-bottom: none;
        }
        .label {
          color: var(--muted);
        }
        .status {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .status-active {
          background: #dcfce7;
          color: #166534;
        }
        .notes {
          margin-top: 1rem;
        }
        .notes .label {
          display: block;
          margin-bottom: 0.5rem;
        }
        .notes p {
          margin: 0;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
        .check-ins-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .check-in-item {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .check-in-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .date {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .rating .star {
          color: var(--border);
        }
        .rating .star.filled {
          color: #eab308;
        }
        .check-in-item .notes {
          margin: 0;
          padding: 0;
          background: none;
        }
      `}</style>
    </main>
  );
}
