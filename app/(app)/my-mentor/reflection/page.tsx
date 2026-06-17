import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { MENTORSHIP_LEGACY_ROOT_SELECT } from "@/lib/mentorship-read-fragments";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import ReflectionForm from "@/app/(app)/my-program/reflect/reflection-form";
import { MyMentorSubnav } from "../_components/my-mentor-subnav";
import Link from "next/link";

export const metadata = { title: "My Reflection — My Mentor" };

export default async function ReflectionPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const primaryRole = session.user.primaryRole ?? "";
  const menteeRoleType = toMenteeRoleType(primaryRole);
  if (!menteeRoleType) redirect("/");

  const [mentorship, goals] = await Promise.all([
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: {
        ...MENTORSHIP_LEGACY_ROOT_SELECT,
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
    const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return (
      <div>
        <div className="topbar">
          <div>
            <p className="badge">My Mentor</p>
            <h1 className="page-title">Monthly Reflection</h1>
          </div>
        </div>
        <MyMentorSubnav />
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontWeight: 600, fontSize: "1.1rem" }}>No reflection open yet</p>
          <p
            style={{
              color: "var(--muted)",
              marginTop: "0.75rem",
              maxWidth: "26rem",
              margin: "0.75rem auto 0",
            }}
          >
            Reflections open at the start of each month once you&apos;re matched with a mentor.
            There&apos;s nothing you need to do right now — we&apos;ll let you know when {monthLabel}&apos;s
            reflection is ready.
          </p>
          <Link
            href="/my-mentor"
            className="button ghost small"
            style={{ marginTop: "1.5rem", display: "inline-block" }}
          >
            ← Back to My Mentor
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
          <p className="badge">My Mentor</p>
          <h1 className="page-title">Monthly Reflection</h1>
          <p className="page-subtitle">
            Cycle {cycleNumber}
            {isQuarterly ? " (Quarterly)" : ""} ·{" "}
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <Link href="/my-mentor" className="button ghost small">
          Cancel
        </Link>
      </div>

      <MyMentorSubnav />

      <div className="card" style={{ marginBottom: 16, borderLeft: "4px solid var(--color-primary)" }}>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>
          <strong>This is for you and your mentor.</strong> Be honest about what&apos;s going well and
          what&apos;s hard — it helps your mentor support you better. Your mentor reads this before
          your monthly review.
        </p>
      </div>

      <ReflectionForm goals={goals} cycleNumber={cycleNumber} isQuarterly={isQuarterly} />
    </div>
  );
}
