import { NextRequest, NextResponse } from "next/server";
import { processPendingNotificationDeliveries } from "@/lib/notification-delivery";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processPendingNotificationDeliveries();
    return NextResponse.json({
      ok: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[NotificationDeliveryQueue] Failed to process deliveries:", error);
    return NextResponse.json({ error: "Failed to process notification deliveries." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Use POST to process queued notification deliveries.",
  });
}
