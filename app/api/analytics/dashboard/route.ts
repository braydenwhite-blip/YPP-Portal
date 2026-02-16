import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const ALLOWED_EVENT_TYPES = new Set([
  "dashboard_card_open",
  "dashboard_queue_open",
  "dashboard_search",
]);

type DashboardAnalyticsPayload = {
  eventType?: string;
  eventData?: Record<string, unknown>;
};

function asInputJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonObject;
}

async function readPayload(request: Request): Promise<DashboardAnalyticsPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as DashboardAnalyticsPayload;
  }

  const raw = await request.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as DashboardAnalyticsPayload;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const payload = await readPayload(request);
  if (!payload.eventType || !ALLOWED_EVENT_TYPES.has(payload.eventType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await prisma.analyticsEvent.create({
    data: {
      userId: session.user.id,
      eventType: payload.eventType,
      eventData: asInputJsonObject(payload.eventData),
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
