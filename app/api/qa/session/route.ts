import { NextResponse } from "next/server";
import { QA_ROLES, setQaRole } from "@/lib/qa-auth-harness";
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_YPP_QA_AUTH !== "true") return NextResponse.json({ error: "QA auth disabled" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (!QA_ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid QA role" }, { status: 400 });
  await setQaRole(body.role);
  return NextResponse.json({ ok: true, role: body.role });
}
