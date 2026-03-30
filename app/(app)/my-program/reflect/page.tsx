import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import ReflectionForm from "./reflection-form";
import Link from "next/link";

export const metadata = { title: "Submit Reflection — My Program" };

export default async function ReflectPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  // Load active mentorship + goals
  const [mentorship, goals] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      include: {
        selfReflections: {
          orderBy: { cycleNumber: "desc" },
          take: 1,
          select: { cycleNumber: true },
        },
      },
    }),
    prisma.mentorshipProgramGoal.findMany({
      where: { roleType: menteeRoleType, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, description: true },
    }),
  ]);

  if (!mentorship) {
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">My Program</p>
            <h1 className="page-title">Submit Reflection</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontWeight: 600 }}>No active mentorship found.</p>
          <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
            You need to be assigned a mentor before submitting reflections.
          </p>
          <Link href="/my-program" className="button ghost small" style={{ marginTop: "1rem", display: "inline-block" }}>
            ← Back to My Program
          </Link>
        </div>
      </div>
    );
  }

  const lastCycle = mentorship.selfReflections[0]?.cycleNumber ?? 0;
  const cycleNumber = lastCycle + 1;
  const isQuarterly = cycleNumber % 3 === 0;

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">My Program</p>
          <h1 className="page-title">Monthly Reflection</h1>
          <p className="page-subtitle">
            Cycle {cycleNumber}
            {isQuarterly ? " (Quarterly)" : ""} ·{" "}
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Link href="/my-program" className="button ghost small">
          Cancel
        </Link>
      </div>

      <ReflectionForm goals={goals} cycleNumber={cycleNumber} isQuarterly={isQuarterly} />
    </div>
  );
}
