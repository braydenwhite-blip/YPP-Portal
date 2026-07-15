import { PageHeaderV2, CardV2, StatusBadge, EmptyStateV2 } from "@/components/ui-v2";
import { getInstructorSupportRequests } from "@/lib/session8/instructor-development";
import { pretty, shortDate } from "@/lib/session8/format";
import { SupportRequestForm } from "./support-request-form";

export default async function InstructorSupportPage() {
  const { requests } = await getInstructorSupportRequests();

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeaderV2
        eyebrow="Instructor development"
        title="Support"
        subtitle="Request help with logistics, materials, roster, scheduling, attendance, student support, or technical issues. There's no fixed response-time guarantee — your chapter's leadership handles requests as they come in."
      />

      <CardV2 padding="lg">
        <SupportRequestForm />
      </CardV2>

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Your requests</h2>
        {requests.length === 0 ? (
          <EmptyStateV2 title="No support requests yet" body="Requests you submit will show up here with their status." />
        ) : (
          requests.map((r) => (
            <CardV2 key={r.id} padding="md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{r.title}</h3>
                  {r.description ? <p className="mt-1 text-sm text-ink-muted">{r.description}</p> : null}
                  <p className="mt-1 text-xs text-ink-muted">Submitted {shortDate(r.createdAt)}</p>
                </div>
                <StatusBadge tone={r.status === "COMPLETE" ? "success" : r.status === "BLOCKED" ? "danger" : "warning"}>
                  {pretty(r.status)}
                </StatusBadge>
              </div>
            </CardV2>
          ))
        )}
      </div>
    </main>
  );
}
