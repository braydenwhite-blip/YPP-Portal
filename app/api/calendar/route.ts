import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateICalForEvent, generateICalForAllEvents } from "@/lib/calendar-actions";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");

  // Users can only export their own calendar — ignore any userId param
  const userId = session.user.id;

  try {
    let icalContent: string;

    if (eventId) {
      icalContent = await generateICalForEvent(eventId);
    } else {
      icalContent = await generateICalForAllEvents(userId);
    }

    return new NextResponse(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="ypp-events${eventId ? `-${eventId}` : ""}.ics"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate calendar" },
      { status: 500 }
    );
  }
}
