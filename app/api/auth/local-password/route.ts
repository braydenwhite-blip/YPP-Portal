import { NextResponse } from "next/server";
import { establishLegacySession } from "@/lib/legacy-auth-server";
import { authenticateLegacyPassword } from "@/lib/legacy-auth-password";
import { isRecoverablePrismaError } from "@/lib/prisma-guard";

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

  let result;
  try {
    result = await authenticateLegacyPassword({ email, password });
  } catch (error) {
    // A Prisma timeout / pool-exhaustion / connector error here should NOT
    // 500 the sign-in — this endpoint is a legacy pre-flight that the login
    // page races against Supabase auth. Return a clean 401 so the client
    // falls through to Supabase immediately instead of blocking on a retry.
    if (isRecoverablePrismaError(error)) {
      console.warn("[local-password] Recoverable Prisma error; skipping legacy auth.", error);
      return NextResponse.json(
        {
          success: false,
          error: "Legacy sign-in temporarily unavailable.",
        },
        { status: 401 }
      );
    }
    throw error;
  }

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
