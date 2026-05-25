/**
 * Static panel that tells the applicant what reviewers look for and how
 * the Summer Workshop pathway connects to the broader instructor program.
 * Pure presentational — kept separate so it can render on the studio
 * landing page, design page, library page, and review/submit page.
 */
export function ReviewerExpectationsCard() {
  return (
    <section
      className="card"
      style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, #f5f3ff 0%, #fdf4ff 100%)",
        borderColor: "#c4b5fd",
      }}
      aria-label="What reviewers look for"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <h3 style={{ marginTop: 0, fontSize: 15, color: "#5b21b6" }}>
            What reviewers look for
          </h3>
          <ul
            style={{
              paddingLeft: 18,
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#4c1d95",
            }}
          >
            <li>A concrete plan a student could walk into</li>
            <li>Specifics over generality — pick one strong idea</li>
            <li>A clear backup plan when the room goes quiet</li>
            <li>Logistics you&rsquo;ve actually thought through</li>
          </ul>
        </div>
        <div>
          <h3 style={{ marginTop: 0, fontSize: 15, color: "#5b21b6" }}>
            Where this leads
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: "#4c1d95",
            }}
          >
            Summer Workshop Instructors are approved YPP educators. Strong
            workshop leads may later be invited to take on full instructor
            roles or mentor newer instructors. There&rsquo;s no automatic
            promotion — readiness shows up in the work — but this is a real
            on-ramp.
          </p>
        </div>
      </div>
    </section>
  );
}
