import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { generateICalForMyClasses } from "@/lib/class-management-actions";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ical = await generateICalForMyClasses(session.user.id);

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ypp-classes.ics"`,
    },
  });
}
