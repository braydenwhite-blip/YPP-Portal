import { redirect, notFound } from "next/navigation";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { ParentInstructorFeedbackForm } from "./parent-instructor-feedback-form";

export const metadata = { title: "Instructor feedback | YPP" };

export default async function ParentInstructorFeedbackPage({
  params,
}: {
  params: Promise<{ instructorId: string }>;
}) {
  const session = await requireSessionUser();
  if (!session.roles.includes("PARENT") && !session.roles.includes("ADMIN")) {
    redirect("/");
  }

  const { instructorId } = await params;
  const instructor = await prisma.user.findUnique({
    where: { id: instructorId },
    select: { id: true, name: true },
  });
  if (!instructor) notFound();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <header className="mb-5">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          Parent feedback
        </p>
        <h1 className="m-0 mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">
          {instructor.name}
        </h1>
      </header>
      <ParentInstructorFeedbackForm
        instructorId={instructor.id}
        instructorName={instructor.name}
      />
    </main>
  );
}
