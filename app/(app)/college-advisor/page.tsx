"use client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getMyCollegeAdvisor,
  getAvailableAdvisors,
  requestAdvisor,
  canAccessCollegeAdvisor,
  getUserAwardTier,
} from "@/lib/alumni-actions";
import Link from "next/link";

export default async function CollegeAdvisorPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const hasAccess = await canAccessCollegeAdvisor();
  const tier = await getUserAwardTier();

  if (!hasAccess) {
    return (
      <main className="main-content">
        <h1>College Advisor</h1>
        <div className="card locked">
          <div className="lock-icon">🎓</div>
          <h2>Silver Award Required</h2>
          <p>
            College Advisor matching is available to members who have earned at
            least a <strong>Silver Award</strong>.
          </p>
          {tier === "BRONZE" ? (
            <p>
              You currently have a <strong>Bronze</strong> tier. Keep up the
              great work to unlock this feature!
            </p>
          ) : (
            <p>
              Continue earning awards to unlock access to college advisors who
              can help guide your academic journey.
            </p>
          )}
          <Link href="/alumni" className="btn btn-primary">
            View Alumni Benefits
          </Link>
        </div>

        <style jsx>{`
          .locked {
            text-align: center;
            padding: 3rem;
            max-width: 500px;
            margin: 2rem auto;
          }
          .lock-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .locked h2 {
            margin: 0 0 1rem;
          }
          .locked p {
            color: var(--muted);
            margin: 0.5rem 0 1.5rem;
          }
        `}</style>
      </main>
    );
  }

  const myAdvisor = await getMyCollegeAdvisor();
  const availableAdvisors = !myAdvisor ? await getAvailableAdvisors() : [];

  if (myAdvisor) {
    const advisor = myAdvisor.advisor;
    const user = advisor.user;

    return (
      <main className="main-content">
        <h1>My College Advisor</h1>

        <div className="advisor-grid">
          <section className="card advisor-profile">
            <div className="advisor-header">
              <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
              <div className="advisor-info">
                <h2>{user.name}</h2>
                <span className="role">Your College Advisor</span>
              </div>
            </div>

            <div className="details">
              <div className="detail-item">
                <span className="icon">🎓</span>
                <div>
                  <strong>{advisor.college}</strong>
                  {advisor.major && (
                    <span className="major"> - {advisor.major}</span>
                  )}
                </div>
              </div>

              {advisor.availability && (
                <div className="detail-item">
                  <span className="icon">📅</span>
                  <span>Available: {advisor.availability}</span>
                </div>
              )}
            </div>

            {advisor.bio && (
              <div className="bio">
                <h3>About Your Advisor</h3>
                <p>{advisor.bio}</p>
              </div>
            )}

            <div className="contact-section">
              <h3>Contact</h3>
              <div className="contact-item">
                <span className="icon">📧</span>
                <a href={`mailto:${user.email}`}>{user.email}</a>
              </div>
              {user.phone && (
                <div className="contact-item">
                  <span className="icon">📱</span>
                  <a href={`tel:${user.phone}`}>{user.phone}</a>
                </div>
              )}
            </div>

            <a href={`mailto:${user.email}`} className="btn btn-primary contact-btn">
              Send Email
            </a>
          </section>

          <section className="card advisorship-details">
            <h3>Advisorship Details</h3>
            <div className="detail-row">
              <span className="label">Started</span>
              <span className="value">
                {new Date(myAdvisor.startDate).toLocaleDateString()}
              </span>
            </div>
            {myAdvisor.notes && (
              <div className="notes">
                <span className="label">Notes</span>
                <p>{myAdvisor.notes}</p>
              </div>
            )}
          </section>

          <section className="card tips-section">
            <h3>Tips for Working with Your Advisor</h3>
            <ul className="tips-list">
              <li>Schedule regular check-ins (monthly or bi-weekly)</li>
              <li>Come prepared with specific questions</li>
              <li>Share your goals and aspirations</li>
              <li>Ask about their college experience</li>
              <li>Be open to feedback and suggestions</li>
            </ul>
          </section>
        </div>

        <style jsx>{`
          .advisor-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;
          }
          @media (max-width: 768px) {
            .advisor-grid {
              grid-template-columns: 1fr;
            }
          }
          .card {
            padding: 1.5rem;
          }
          .advisor-profile {
            grid-row: span 2;
          }
          .advisor-header {
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
          }
          .advisor-info h2 {
            margin: 0;
          }
          .role {
            color: var(--muted);
          }
          .details {
            margin-bottom: 1.5rem;
          }
          .detail-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0;
          }
          .icon {
            font-size: 1.25rem;
          }
          .major {
            color: var(--muted);
          }
          .bio {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: var(--background);
            border-radius: 0.5rem;
          }
          .bio h3 {
            margin: 0 0 0.5rem;
            font-size: 0.875rem;
          }
          .bio p {
            margin: 0;
            color: var(--muted);
          }
          .contact-section {
            margin-bottom: 1.5rem;
          }
          .contact-section h3 {
            margin: 0 0 0.75rem;
            font-size: 0.875rem;
          }
          .contact-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0;
          }
          .contact-item a {
            color: var(--primary);
            text-decoration: none;
          }
          .contact-btn {
            width: 100%;
            text-align: center;
            text-decoration: none;
          }
          .advisorship-details h3,
          .tips-section h3 {
            margin: 0 0 1rem;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
          }
          .label {
            color: var(--muted);
          }
          .value {
            font-weight: 600;
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
          .tips-list {
            margin: 0;
            padding-left: 1.5rem;
          }
          .tips-list li {
            padding: 0.5rem 0;
            color: var(--muted);
          }
        `}</style>
      </main>
    );
  }

  // No advisor - show available advisors
  return (
    <main className="main-content">
      <h1>College Advisor</h1>
      <p className="intro">
        Connect with a YPP alumni who can guide you through your college
        journey. Request an advisor below.
      </p>

      {availableAdvisors.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🎓</div>
          <h2>No Advisors Available</h2>
          <p>
            There are no college advisors available at this time. Please check
            back later.
          </p>
        </div>
      ) : (
        <div className="advisors-grid">
          {availableAdvisors.map((advisor) => (
            <div key={advisor.id} className="card advisor-card">
              <div className="advisor-header">
                <div className="avatar">
                  {advisor.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="advisor-info">
                  <h3>{advisor.user.name}</h3>
                  <span className="college">{advisor.college}</span>
                </div>
              </div>

              {advisor.major && (
                <div className="detail">
                  <span className="icon">📚</span>
                  <span>{advisor.major}</span>
                </div>
              )}

              {advisor.availability && (
                <div className="detail">
                  <span className="icon">📅</span>
                  <span>{advisor.availability}</span>
                </div>
              )}

              <div className="detail">
                <span className="icon">👥</span>
                <span>{advisor._count.advisees} current advisees</span>
              </div>

              {advisor.bio && <p className="bio">{advisor.bio}</p>}

              <form action={requestAdvisor.bind(null, advisor.id)}>
                <button type="submit" className="btn btn-primary request-btn">
                  Request This Advisor
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .intro {
          color: var(--muted);
          margin-bottom: 2rem;
        }
        .empty {
          text-align: center;
          padding: 3rem;
          max-width: 500px;
          margin: 2rem auto;
        }
        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .empty h2 {
          margin: 0 0 1rem;
        }
        .empty p {
          color: var(--muted);
          margin: 0;
        }
        .advisors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .advisor-card {
          padding: 1.5rem;
        }
        .advisor-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.25rem;
        }
        .advisor-info h3 {
          margin: 0;
        }
        .college {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .detail {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }
        .bio {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 1rem 0;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .request-btn {
          width: 100%;
        }
      `}</style>
    </main>
  );
}
