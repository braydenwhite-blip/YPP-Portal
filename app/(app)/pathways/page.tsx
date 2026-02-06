import { prisma } from "@/lib/prisma";

export default async function PathwaysPage() {
  const pathways = await prisma.pathway.findMany({
    include: {
      steps: {
        include: { course: true },
        orderBy: { stepOrder: "asc" }
      }
    }
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">YPP Pathways</p>
          <h1 className="page-title">Pathways Overview</h1>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Core Components</h3>
          <p>
            Pathways connects curriculum structure, events & competition prep, mentorship, and instructor
            development into one clear progression across chapters.
          </p>
          <div className="timeline" style={{ marginTop: 16 }}>
            <div className="timeline-item">
              <strong>Curriculum Structure:</strong> one-off classes, leveled 101/201/301, Passion Labs, and
              the Commons.
            </div>
            <div className="timeline-item">
              <strong>Events & Prep:</strong> showcases, festivals, and competition preparation feed into Labs
              and Commons.
            </div>
            <div className="timeline-item">
              <strong>Mentorship:</strong> monthly and quarterly check-ins for instructors and students to stay
              on track.
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Why This Structure</h3>
          <p>
            Pathways reduces student drop-off by showing a clear next step after each class. It keeps
            instructors growing by expanding beyond repeat lessons and aligning everyone around a shared
            standard of quality.
          </p>
          <div className="grid two" style={{ marginTop: 16 }}>
            <div>
              <div className="kpi">101 → 301</div>
              <div className="kpi-label">Leveled Progression</div>
            </div>
            <div>
              <div className="kpi">Labs + Commons</div>
              <div className="kpi-label">Project & Mentorship</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="section-title">Active Pathways</div>
        {pathways.length === 0 ? (
          <div className="card">No pathways have been created yet.</div>
        ) : (
          <div className="grid two">
            {pathways.map((pathway) => (
              <div key={pathway.id} className="card">
                <h3>{pathway.name}</h3>
                <p>{pathway.description}</p>
                <div style={{ marginTop: 12 }}>
                  {pathway.steps.map((step) => (
                    <div key={step.id} style={{ marginBottom: 8 }}>
                      <span className="pill">
                        {step.course.format === "LEVELED" && step.course.level
                          ? step.course.level.replace("LEVEL_", "")
                          : step.course.format.replace("_", " ")}
                      </span>{" "}
                      {step.course.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
