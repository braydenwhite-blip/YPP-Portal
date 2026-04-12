import { NextResponse } from "next/server";
import { establishLegacySession } from "@/lib/legacy-auth-server";
import { authenticateLegacyPassword } from "@/lib/legacy-auth-password";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body.email === "string" ? body.email : "";
  const password =
    body && typeof body.password === "string" ? body.password : "";

  if (!email.trim() || !password) {
    return NextResponse.json(
      {
        success: false,
        error: "Email and password are required.",
      },
      { status: 400 }
    );
  }

  const result = await authenticateLegacyPassword({ email, password });
  if (!result.success) {
    return NextResponse.json(result, { status: 401 });
  }

  await establishLegacySession({
    userId: result.userId,
    email: result.email,
    mode: result.mode,
  });

  return NextResponse.json({ success: true });
}
