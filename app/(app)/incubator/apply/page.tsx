import Link from "next/link";
import { getActiveCohort } from "@/lib/incubator-actions";
import { prisma } from "@/lib/prisma";
import ApplyToIncubatorForm from "./client";

export default async function ApplyToIncubatorPage() {
  const cohort = await getActiveCohort();

  if (!cohort || cohort.status !== "ACCEPTING_APPLICATIONS") {
    return (
      <div>
        <div className="topbar"><h1 className="page-title">Apply to Incubator</h1></div>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <h3>No cohort accepting applications right now</h3>
          <p style={{ color: "var(--text-secondary)" }}>Check back soon for the next incubator cohort.</p>
          <Link href="/incubator" className="button secondary" style={{ marginTop: 12 }}>Back to Incubator</Link>
        </div>
      </div>
    );
  }

  const allowedPassionIds = cohort.passionAreaIds.length > 0 ? cohort.passionAreaIds : undefined;
  const passions = await prisma.passionArea.findMany({
    where: {
      isActive: true,
      ...(allowedPassionIds ? { id: { in: allowedPassionIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">Apply to the Incubator</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            {cohort.name} · Build a launch-ready project with milestones and mentor support
          </p>
        </div>
        <Link href="/incubator" className="button secondary">Back</Link>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 20,
          background: "linear-gradient(135deg, #fff7ed 0%, #eff6ff 55%, #f0fdf4 100%)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#c2410c" }}>Step 1</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>Choose the project</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Tell us what you want to launch and why it matters.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#1d4ed8" }}>Step 2</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>Show the plan</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>Help us see the first version you can build in this cohort.</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#15803d" }}>Step 3</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>Match the support</div>
            <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>We use this application to assign a mentor and seed your milestone studio.</div>
          </div>
        </div>
      </div>

      <ApplyToIncubatorForm cohort={cohort as any} passions={passions} />
    </div>
  );
}
