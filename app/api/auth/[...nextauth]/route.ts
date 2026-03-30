import { NextResponse } from "next/server";

function retiredResponse() {
  return NextResponse.json(
    {
      error: "NextAuth endpoint retired",
      message: "Authentication now uses Supabase Auth. Start from /login.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return retiredResponse();
}

export async function POST() {
  return retiredResponse();
}
