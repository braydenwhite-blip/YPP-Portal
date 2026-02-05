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
      <main className="main-content my-mentor-page">
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

        <style>{`

          .my-mentor-page .no-mentor {
            text-align: center;
            padding: 3rem;
            max-width: 500px;
            margin: 2rem auto;
          }
          .my-mentor-page .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .my-mentor-page .no-mentor h2 {
            margin: 0 0 1rem;
          }
          .my-mentor-page .no-mentor p {
            color: var(--muted);
            margin: 0;
          }
        
`}</style>
      </main>
    );
  }

  const mentor = mentorship.mentor;

  return (
    <main className="main-content my-mentor-page">
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

      <style>{`

        .my-mentor-page .mentor-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 768px) {
          .my-mentor-page .mentor-grid {
            grid-template-columns: 1fr;
          }
        }
        .my-mentor-page .card {
          padding: 1.5rem;
        }
        .my-mentor-page .mentor-profile {
          grid-row: span 2;
        }
        .my-mentor-page .mentor-header {
          display: flex;
          gap: 1.5rem;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .my-mentor-page .avatar {
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
        .my-mentor-page .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .my-mentor-page .mentor-info h2 {
          margin: 0;
        }
        .my-mentor-page .role {
          color: var(--muted);
          font-size: 0.875rem;
        }
        .my-mentor-page .bio {
          margin-bottom: 1.5rem;
        }
        .my-mentor-page .bio h3,
        .my-mentor-page .contact-section h3 {
          margin: 0 0 0.75rem;
          font-size: 1rem;
        }
        .my-mentor-page .bio p {
          margin: 0;
          color: var(--muted);
        }
        .my-mentor-page .contact-section {
          margin-bottom: 1.5rem;
        }
        .my-mentor-page .contact-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 0;
        }
        .my-mentor-page .contact-item .icon {
          font-size: 1.25rem;
        }
        .my-mentor-page .contact-item a {
          color: var(--primary);
          text-decoration: none;
        }
        .my-mentor-page .contact-item a:hover {
          text-decoration: underline;
        }
        .my-mentor-page .actions {
          padding-top: 1.5rem;
          border-top: 1px solid var(--border);
        }
        .my-mentor-page .mentorship-details h3,
        .my-mentor-page .check-ins h3 {
          margin: 0 0 1rem;
        }
        .my-mentor-page .detail-item {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
        }
        .my-mentor-page .detail-item:last-child {
          border-bottom: none;
        }
        .my-mentor-page .label {
          color: var(--muted);
        }
        .my-mentor-page .status {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 500;
        }
        .my-mentor-page .status-active {
          background: #dcfce7;
          color: #166534;
        }
        .my-mentor-page .notes {
          margin-top: 1rem;
        }
        .my-mentor-page .notes .label {
          display: block;
          margin-bottom: 0.5rem;
        }
        .my-mentor-page .notes p {
          margin: 0;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .my-mentor-page .empty {
          color: var(--muted);
          font-style: italic;
        }
        .my-mentor-page .check-ins-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .my-mentor-page .check-in-item {
          padding: 1rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .my-mentor-page .check-in-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }
        .my-mentor-page .date {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .my-mentor-page .rating .star {
          color: var(--border);
        }
        .my-mentor-page .rating .star.filled {
          color: #eab308;
        }
        .my-mentor-page .check-in-item .notes {
          margin: 0;
          padding: 0;
          background: none;
        }
      
`}</style>
    </main>
  );
}
