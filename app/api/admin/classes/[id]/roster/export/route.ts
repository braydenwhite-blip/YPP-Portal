import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { getAdminClassRoster } from "@/lib/admin-class-operations";

/**
 * Admin-only CSV export of a class roster. A GET handler so it can be a simple
 * download link from the roster page. Reuses getAdminClassRoster (which already
 * enforces ADMIN) for the data; the session check here is defense-in-depth and
 * lets us return a clean 403/404 for direct hits.
 */

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id || !session.user.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const roster = await getAdminClassRoster(id);
  if (!roster) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const header = [
    "Student Name",
    "Student Email",
    "Grade",
    "School",
    "Parent/Guardian",
    "Parent Email",
    "Status",
    "Waitlist Position",
    "Signed Up",
    "Sessions Attended",
    "Why They Signed Up",
  ];

  const rows = roster.enrollments.map((e) => {
    const parent = e.student.studentLinks?.[0]?.parent;
    const parentName = parent?.name ?? "";
    const parentEmail = parent?.email ?? e.student.profile?.parentEmail ?? "";
    const goal = [e.signupGoal, e.signupNote].filter(Boolean).join(" — ");
    return [
      csvCell(e.student.name),
      csvCell(e.student.email),
      csvCell(e.student.profile?.grade ?? ""),
      csvCell(e.student.profile?.school ?? ""),
      csvCell(parentName),
      csvCell(parentEmail),
      csvCell(e.status),
      csvCell(e.waitlistPosition ?? ""),
      csvCell(e.enrolledAt.toISOString().split("T")[0]),
      csvCell(e.sessionsAttended),
      csvCell(goal),
    ].join(",");
  });

  const csv = [header.map(csvCell).join(","), ...rows].join("\n");
  const safeTitle = roster.offering.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roster-${safeTitle}-${date}.csv"`,
    },
  });
}
