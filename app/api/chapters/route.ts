import { NextResponse } from "next/server";

import {
  ensureOperatingChapters,
  listOperatingChaptersForFilters,
} from "@/lib/chapters/operating";

export const dynamic = "force-dynamic";

export async function GET() {
  // Self-heal: ensure all operating chapters exist and are public/unarchived
  // before returning the applicant signup dropdown.
  await ensureOperatingChapters();
  const chapters = await listOperatingChaptersForFilters();
  return NextResponse.json(chapters);
}
