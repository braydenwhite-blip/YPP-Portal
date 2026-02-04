import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAlumniDirectory,
  canAccessAlumniDirectory,
  getUserAwardTier,
  getMyAwards,
  updateMyAlumniProfile,
  getMyAlumniProfile,
} from "@/lib/alumni-actions";
import Link from "next/link";

export default async function AlumniPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const hasAccess = await canAccessAlumniDirectory();
  const tier = await getUserAwardTier();
  const { awards } = await getMyAwards();

  if (!hasAccess) {
    return (
      <main className="main-content">
        <h1>Alumni Directory</h1>
        <div className="card locked">
          <div className="lock-icon">🔒</div>
          <h2>Access Required</h2>
          <p>
            The Alumni Directory is available to members who have earned at
            least a <strong>Bronze Award</strong>.
          </p>
          <p>
            Continue your YPP journey, complete courses and training, and earn
            awards to unlock this feature!
          </p>

          <div className="award-tiers">
            <h3>Award Tiers & Benefits</h3>
            <div className="tier">
              <span className="tier-badge bronze">Bronze</span>
              <span>Alumni Directory Access, Alumni Events</span>
            </div>
            <div className="tier">
              <span className="tier-badge silver">Silver</span>
              <span>+ College Advisor Assignment</span>
            </div>
            <div className="tier">
              <span className="tier-badge gold">Gold</span>
              <span>+ Additional Premium Features</span>
            </div>
          </div>

          <h4>Your Awards ({awards.length})</h4>
          {awards.length === 0 ? (
            <p className="no-awards">You haven't earned any awards yet.</p>
          ) : (
            <ul className="awards-list">
              {awards.map((award) => (
                <li key={award.id}>{award.name}</li>
              ))}
            </ul>
          )}
        </div>

        <style jsx>{`
          .locked {
            text-align: center;
            padding: 3rem;
            max-width: 600px;
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
            margin: 0.5rem 0;
          }
          .award-tiers {
            margin: 2rem 0;
            padding: 1.5rem;
            background: var(--background);
            border-radius: 0.5rem;
            text-align: left;
          }
          .award-tiers h3 {
            margin: 0 0 1rem;
          }
          .tier {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem 0;
            border-bottom: 1px solid var(--border);
          }
          .tier:last-child {
            border-bottom: none;
          }
          .tier-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          .tier-badge.bronze {
            background: #fef3c7;
            color: #92400e;
          }
          .tier-badge.silver {
            background: #e5e7eb;
            color: #374151;
          }
          .tier-badge.gold {
            background: #fef9c3;
            color: #854d0e;
          }
          .locked h4 {
            margin: 1.5rem 0 0.5rem;
          }
          .no-awards {
            font-style: italic;
          }
          .awards-list {
            list-style: none;
            padding: 0;
            text-align: left;
          }
          .awards-list li {
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--border);
          }
        `}</style>
      </main>
    );
  }

  const alumni = await getAlumniDirectory();
  const myProfile = await getMyAlumniProfile();

  return (
    <main className="main-content">
      <div className="page-header">
        <div>
          <h1>Alumni Directory</h1>
          <p className="subtitle">
            Connect with fellow YPP alumni
            <span className="tier-badge tier-{tier?.toLowerCase()}">{tier}</span>
          </p>
        </div>
        <Link href="/alumni/events" className="btn btn-secondary">
          Alumni Events
        </Link>
      </div>

      {/* Your Profile */}
      <section className="card profile-section">
        <h2>Your Alumni Profile</h2>
        <form action={updateMyAlumniProfile}>
          <div className="form-row">
            <div className="form-group">
              <label>Graduation Year</label>
              <input
                type="number"
                name="graduationYear"
                defaultValue={myProfile?.graduationYear || ""}
                placeholder="2024"
                min="2000"
                max="2030"
              />
            </div>
            <div className="form-group">
              <label>College/University</label>
              <input
                type="text"
                name="college"
                defaultValue={myProfile?.college || ""}
                placeholder="Your college"
              />
            </div>
            <div className="form-group">
              <label>Major</label>
              <input
                type="text"
                name="major"
                defaultValue={myProfile?.major || ""}
                placeholder="Your major"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Current Role</label>
            <input
              type="text"
              name="currentRole"
              defaultValue={myProfile?.currentRole || ""}
              placeholder="e.g., Software Engineer at Google"
            />
          </div>
          <div className="form-group">
            <label>Bio</label>
            <textarea
              name="bio"
              rows={3}
              defaultValue={myProfile?.bio || ""}
              placeholder="Tell other alumni about yourself..."
            />
          </div>
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isVisible"
                value="true"
                defaultChecked={myProfile?.isVisible !== false}
              />
              Show my profile in the directory
            </label>
            <button type="submit" className="btn btn-primary">
              Update Profile
            </button>
          </div>
        </form>
      </section>

      {/* Alumni Directory */}
      <section className="directory-section">
        <h2>Alumni ({alumni.length})</h2>
        {alumni.length === 0 ? (
          <div className="card">
            <p className="empty">No alumni profiles visible yet.</p>
          </div>
        ) : (
          <div className="alumni-grid">
            {alumni.map((profile) => (
              <div key={profile.id} className="card alumni-card">
                <div className="alumni-header">
                  <div className="avatar">
                    {profile.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="alumni-info">
                    <h3>{profile.user.name}</h3>
                    {profile.graduationYear && (
                      <span className="year">Class of {profile.graduationYear}</span>
                    )}
                  </div>
                </div>

                {profile.college && (
                  <div className="detail">
                    <span className="icon">🎓</span>
                    <span>
                      {profile.college}
                      {profile.major && ` - ${profile.major}`}
                    </span>
                  </div>
                )}

                {profile.currentRole && (
                  <div className="detail">
                    <span className="icon">💼</span>
                    <span>{profile.currentRole}</span>
                  </div>
                )}

                {profile.bio && <p className="bio">{profile.bio}</p>}

                {profile.user.awards.length > 0 && (
                  <div className="awards">
                    {profile.user.awards.slice(0, 3).map((award) => (
                      <span key={award.id} className="award-badge">
                        {award.name}
                      </span>
                    ))}
                  </div>
                )}

                <a
                  href={`mailto:${profile.user.email}`}
                  className="contact-btn"
                >
                  Connect
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .subtitle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--muted);
          margin: 0.5rem 0 0;
        }
        .tier-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .tier-bronze {
          background: #fef3c7;
          color: #92400e;
        }
        .tier-silver {
          background: #e5e7eb;
          color: #374151;
        }
        .tier-gold {
          background: #fef9c3;
          color: #854d0e;
        }
        .profile-section {
          padding: 1.5rem;
          margin-bottom: 2rem;
        }
        .profile-section h2 {
          margin: 0 0 1rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          align-items: end;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        input,
        textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 0.5rem;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .directory-section h2 {
          margin: 0 0 1rem;
        }
        .alumni-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .alumni-card {
          padding: 1.5rem;
        }
        .alumni-header {
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
        .alumni-info h3 {
          margin: 0;
        }
        .year {
          font-size: 0.875rem;
          color: var(--muted);
        }
        .detail {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        .bio {
          font-size: 0.875rem;
          color: var(--muted);
          margin: 1rem 0;
          padding: 0.75rem;
          background: var(--background);
          border-radius: 0.5rem;
        }
        .awards {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .award-badge {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          background: #fef3c7;
          color: #92400e;
          border-radius: 0.25rem;
        }
        .contact-btn {
          display: block;
          text-align: center;
          padding: 0.75rem;
          background: var(--primary);
          color: white;
          text-decoration: none;
          border-radius: 0.5rem;
          font-weight: 500;
        }
        .contact-btn:hover {
          opacity: 0.9;
        }
        .empty {
          color: var(--muted);
          font-style: italic;
        }
      `}</style>
    </main>
  );
}
