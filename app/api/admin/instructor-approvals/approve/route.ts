import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy instructor approval route retired. Use /admin/instructor-readiness for offering approvals.",
    },
    { status: 410 }
  );
}
