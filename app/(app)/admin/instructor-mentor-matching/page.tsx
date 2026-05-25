import { requireAdminPage } from "@/lib/page-guards";
import { loadMentorMatchingData } from "@/lib/instructor-ops-actions";
import Link from "next/link";
import MentorMatchingBoard from "./mentor-matching-board";

export const dynamic = "force-dynamic";

export default async function InstructorMentorMatchingPage() {
  await requireAdminPage();

  const { mentors, unmatched } = await loadMentorMatchingData();

  const totalCapacity = mentors.reduce((a, m) => a + m.maxMentees, 0);
  const totalFilled = mentors.reduce((a, m) => a + m.currentMenteeCount, 0);
  const availableSlots = mentors.reduce((a, m) => a + m.availableSlots, 0);

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Admin · Instructor Ops</p>
          <h1 className="page-title">Mentor Matching</h1>
          <p className="page-subtitle">
            Assign instructors to mentors. Drag an unmatched instructor onto a mentor card
            to pair them.
          </p>
        </div>
        <Link href="/admin/instructors" className="button">
          ← All Instructors
        </Link>
      </div>

      <div className="grid four" style={{ gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{mentors.length}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Available mentors</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: availableSlots > 0 ? "#16a34a" : "#dc2626" }}>
            {availableSlots}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Open mentor slots</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: unmatched.length > 0 ? "#d97706" : "#71717a" }}>
            {unmatched.length}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Unmatched instructors</div>
        </div>
        <div className="card" style={{ padding: "14px 18px" }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {totalCapacity > 0 ? Math.round((totalFilled / totalCapacity) * 100) : 0}%
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Mentor capacity used</div>
        </div>
      </div>

      <MentorMatchingBoard mentors={mentors} unmatched={unmatched} />
    </div>
  );
}
