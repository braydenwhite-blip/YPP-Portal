import { notFound } from "next/navigation";

import { CardV2 } from "@/components/ui-v2";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { getPublicClassDetail } from "@/lib/classes/public-catalog-loader";
import { detectDuplicateEnrollment } from "@/lib/classes/public-catalog";
import { ClassSignupPanel } from "@/components/classes/class-signup-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const detail = await getPublicClassDetail(params.id);
  return { title: detail ? `${detail.title} — Youth Passion Project` : "Class — Youth Passion Project" };
}

// Public class detail + family signup. Polished, reassuring, and honest — and a
// real enrollment for signed-in students via the existing race-safe path.
export default async function PublicClassDetailPage({ params }: { params: { id: string } }) {
  const detail = await getPublicClassDetail(params.id);
  if (!detail) notFound();

  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const isAuthenticated = Boolean(session?.user?.id);
  const isStudent = roles.includes("STUDENT");

  let alreadyEnrolled = false;
  if (isStudent && session?.user?.id) {
    const existing = await prisma.classEnrollment.findUnique({
      where: { studentId_offeringId: { studentId: session.user.id, offeringId: detail.id } },
      select: { status: true },
    });
    alreadyEnrolled = existing ? detectDuplicateEnrollment([existing.status]) : false;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <a href="/classes" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
        ← All classes
      </a>

      <header className="mt-3">
        <h1 className="m-0 text-[26px] font-bold text-ink">{detail.title}</h1>
        <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
          {detail.scheduleLabel} · {detail.locationLabel}
          {detail.chapterName ? ` · ${detail.chapterName}` : ""}
        </p>
      </header>

      <CardV2 className="mt-4">
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Fact label="Starts" value={detail.startDateLabel} />
          <Fact label="Sessions" value={detail.sessionsCount > 0 ? `${detail.sessionsCount}` : "TBD"} />
          <Fact label="Ages" value={detail.ageRange ? detail.ageRange.replace(/-/g, "–") : "All welcome"} />
          <Fact
            label="Spots"
            value={detail.spotsRemaining == null ? "Open" : detail.spotsRemaining > 0 ? `${detail.spotsRemaining} left` : "Waitlist"}
          />
        </dl>
      </CardV2>

      {detail.description && (
        <Section title="What is this class?">
          <p className="m-0 whitespace-pre-line text-[14px] leading-relaxed text-ink">{detail.description}</p>
        </Section>
      )}

      {detail.learningOutcomes.length > 0 && (
        <Section title="What students learn">
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[14px] text-ink">
            {detail.learningOutcomes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </Section>
      )}

      {detail.instructorName && (
        <Section title="Who teaches it">
          <p className="m-0 text-[14px] text-ink">
            Led by <span className="font-semibold">{detail.instructorName}</span>, a trained Youth Passion Project
            instructor.
          </p>
        </Section>
      )}

      <div className="mt-6">
        <ClassSignupPanel
          offeringId={detail.id}
          title={detail.title}
          scheduleLabel={detail.scheduleLabel}
          locationLabel={detail.locationLabel}
          availability={detail.availability}
          viewer={{ isAuthenticated, isStudent, alreadyEnrolled }}
        />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
      <dd className="m-0 text-[14px] font-bold text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="m-0 mb-2 text-[14px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}
