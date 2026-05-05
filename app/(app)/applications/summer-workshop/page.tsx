import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import {
  isRegularInstructorEnabled,
  isSummerWorkshopInstructorEnabled,
} from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Landing page for the temporary Instructor gate. Surfaces the only open
 * pathway (Summer Workshop Instructor) so users redirected here understand
 * what's happening rather than seeing a dead-end "not available" screen.
 */
export default async function SummerWorkshopLandingPage() {
  const session = await getSession();
  const userId = session?.user?.id ?? null;

  // If the regular Instructor program has been re-enabled, this gate page
  // shouldn't exist as an entry point — bounce to the normal applications list.
  if (isRegularInstructorEnabled() && userId) {
    redirect("/applications");
  }

  // If the user already has a Summer Workshop application in flight, take
  // them straight to it instead of forcing a new signup attempt.
  const existingApp = userId
    ? await withPrismaFallback(
        () =>
          prisma.instructorApplication.findFirst({
            where: {
              applicantUserId: userId,
              applicationTrack: "SUMMER_WORKSHOP_INSTRUCTOR",
            },
            select: { id: true, status: true },
            orderBy: { createdAt: "desc" },
          }),
        null
      )
    : null;

  if (existingApp) {
    redirect(`/applications/instructor/${existingApp.id}`);
  }

  const summerOpen = isSummerWorkshopInstructorEnabled();

  return (
    <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          fontSize: 13,
          color: "#5b21b6",
          marginBottom: 24,
        }}
      >
        Full Instructor Program coming soon — apply for Summer Workshops now.
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px" }}>
        Summer Workshop Instructor Application
      </h1>
      <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 24px" }}>
        We&apos;re focused on Summer Workshops right now. Run a short workshop at one
        of our camps — share a single workshop outline so we can see how you&apos;d run
        a session. Strong workshop instructors can later be promoted to full Instructor.
      </p>

      {summerOpen ? (
        <Link
          href="/signup/instructor"
          className="button"
          style={{ display: "inline-block", padding: "12px 20px", fontSize: 14, fontWeight: 600 }}
        >
          Apply as Summer Workshop Instructor
        </Link>
      ) : (
        <p style={{ fontSize: 14, color: "var(--muted)" }}>
          Applications are temporarily closed. Please check back soon.
        </p>
      )}

      <p style={{ marginTop: 32, fontSize: 13, color: "var(--muted)" }}>
        Already applied?{" "}
        <Link href="/application-status" style={{ color: "#6b21c8" }}>
          Check your application status
        </Link>
        .
      </p>
    </div>
  );
}
