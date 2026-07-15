import Link from "next/link";
import { PageHeaderV2, CardV2, StatusBadge, EmptyStateV2 } from "@/components/ui-v2";
import { getInstructorTraining } from "@/lib/session8/instructor-development";
import { pretty, shortDate } from "@/lib/session8/format";

export default async function InstructorTrainingPage() {
  const { certifications } = await getInstructorTraining();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Instructor development"
        title="Training"
        subtitle="Your certification progress, plus the full coursework subsystem."
      />

      <CardV2 padding="md">
        <h2 className="text-base font-semibold text-ink">Instructor training coursework</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Required and optional coursework, lessons, and completion tracking live in the training subsystem.
        </p>
        <Link href="/instructor-training" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Go to instructor training →
        </Link>
      </CardV2>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Certifications</h2>
        {certifications.length === 0 ? (
          <EmptyStateV2
            title="No certifications on record"
            body="Certification progress will appear here once you start a certification track."
          />
        ) : (
          certifications.map((cert) => (
            <CardV2 key={cert.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {cert.certType}
                    {cert.passionArea ? ` · ${cert.passionArea}` : ""}
                  </h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {cert.totalCompleted} of {cert.totalRequired} requirements complete
                    {cert.certifiedAt ? ` · Certified ${shortDate(cert.certifiedAt)}` : ""}
                  </p>
                </div>
                <StatusBadge tone={cert.status === "CERTIFIED" ? "success" : cert.status === "EXPIRED" ? "danger" : "warning"}>
                  {pretty(cert.status)}
                </StatusBadge>
              </div>
            </CardV2>
          ))
        )}
      </div>
    </main>
  );
}
