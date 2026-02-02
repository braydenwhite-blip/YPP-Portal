import { prisma } from "@/lib/prisma";

export default async function MentorshipPage() {
  const mentorships = await prisma.mentorship.findMany({
    include: { mentor: true, mentee: true, checkIns: true }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Mentorship Program</p>
          <h1 className="page-title">Mentorship Dashboard</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Instructor Mentorship</h3>
          <p>
            Monthly and quarterly check-ins, growth feedback, and achievement awards keep instructors
            supported while improving class quality across chapters.
          </p>
        </div>
        <div className="card">
          <h3>Student Mentorship</h3>
          <p>
            Students receive guidance after classes, labs, or events to help them select the next
            pathway step and stay connected to YPP.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="section-title">Active Pairings</div>
        <div className="card">
          {mentorships.length === 0 ? (
            <p>No mentorships created yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Mentee</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {mentorships.map((pairing) => (
                  <tr key={pairing.id}>
                    <td>{pairing.mentor.name}</td>
                    <td>{pairing.mentee.name}</td>
                    <td>{pairing.type}</td>
                    <td>{pairing.status}</td>
                    <td>{pairing.checkIns.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
