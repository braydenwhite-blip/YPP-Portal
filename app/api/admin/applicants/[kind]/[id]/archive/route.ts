import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth-supabase";
import {
  archiveApplicantSubmissionById,
  type ApplicantSubmissionKind,
} from "@/lib/instructor-application-actions";

const KINDS: ApplicantSubmissionKind[] = [
  "instructor",
  "application",
  "chapter-president",
  "incubator",
  "internship",
];

function isKind(value: string): value is ApplicantSubmissionKind {
  return (KINDS as string[]).includes(value);
}

/**
 * POST /api/admin/applicants/:kind/:id/archive
 *
 * Soft-archive a single applicant submission. `kind` is one of:
 *   instructor | application | chapter-president | incubator | internship
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { kind: string; id: string } }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(session.user.roles ?? []).includes("ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { kind, id } = params;
  if (!isKind(kind)) {
    return NextResponse.json(
      { error: `Invalid kind. Must be one of: ${KINDS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const archived = await archiveApplicantSubmissionById(kind, id, {
      actorId: session.user.id,
    });
    if (!archived) {
      return NextResponse.json(
        { ok: false, error: "Not found or already archived" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[archive-applicant]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
