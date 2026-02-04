import { NextRequest, NextResponse } from "next/server";
import { generateICalForEvent, generateICalForAllEvents } from "@/lib/calendar-actions";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const userId = searchParams.get("userId");

  try {
    let icalContent: string;

    if (eventId) {
      // Single event
      icalContent = await generateICalForEvent(eventId);
    } else {
      // All events (optionally filtered by user's RSVPs)
      icalContent = await generateICalForAllEvents(userId || undefined);
    }

    return new NextResponse(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="ypp-events${eventId ? `-${eventId}` : ""}.ics"`,
      },
    });
  } catch (error) {
    console.error("Calendar export error:", error);
    return NextResponse.json(
      { error: "Failed to generate calendar" },
      { status: 500 }
    );
  }
}
