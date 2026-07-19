import { getInstructorHome } from "@/lib/session8/instructor-ops";
import { resolveInstructorFollowUp } from "@/lib/session8/instructor-actions";
import { S8Page, S8Grid, S8Card, S8List, S8Item, S8FormButton } from "@/components/session8/portal-ui";
import { dateTime } from "@/lib/session8/format";
import { actionItemStatusLabel } from "@/lib/session8/labels";

export default async function Page() {
  const d: any = await getInstructorHome();

  return (
    <S8Page
      eyebrow="Instructor portal"
      title="Teaching command center"
      body="Prepare sessions, manage classes, record attendance, respond to attendance reviews, and track follow-ups from one place."
      primaryHref="/instructor/classes"
      primaryLabel="My classes"
    >
      <S8Grid>
        {d.nextSession && (
          <S8Card title="Up Next">
            <S8Item
              title={d.nextSession.offering.title}
              meta={`${dateTime(d.nextSession.date, d.nextSession.startTime)} · ${d.nextSession.topic}`}
              status="UPCOMING"
              href={`/instructor/classes/${d.nextSession.offeringId}/sessions/${d.nextSession.id}`}
            >
              {d.nextSession.offering.deliveryMode} · {d.nextSession.offering.locationName ?? "Location/link pending"}
            </S8Item>
          </S8Card>
        )}

        {d.upcomingUnprepared.length > 0 && (
          <S8Card title="Preparation Needed (Next 7 Days)">
            <S8List
              items={d.upcomingUnprepared.slice(0, 6)}
              empty=""
              render={(s: any) => (
                <S8Item
                  key={s.id}
                  title={`Prepare ${s.topic}`}
                  meta={`${s.offering.title} · ${dateTime(s.date, s.startTime)}`}
                  status="PREP NEEDED"
                  href={`/instructor/classes/${s.offeringId}/sessions/${s.id}`}
                />
              )}
            />
          </S8Card>
        )}

        {d.attendanceGaps.length > 0 && (
          <S8Card title="Attendance Needs Finishing">
            <S8List
              items={d.attendanceGaps.slice(0, 6)}
              empty=""
              render={(g: any) => (
                <S8Item
                  key={g.session.id}
                  title={g.offering.title}
                  meta={`${dateTime(g.session.date, g.session.startTime)} · ${g.missingCount} missing · ${g.unfinalizedCount} not finalized`}
                  status="ATTENDANCE"
                  href={`/instructor/classes/${g.offering.id}/sessions/${g.session.id}`}
                />
              )}
            />
          </S8Card>
        )}

        {d.openReviewRequests.length > 0 && (
          <S8Card title="Attendance Review Requests" subtitle={`${d.openReviewRequests.length} open`}>
            <S8List
              items={d.openReviewRequests.slice(0, 6)}
              empty=""
              render={(r: any) => (
                <S8Item
                  key={r.id}
                  title="Attendance review requested"
                  meta={new Date(r.createdAt).toLocaleDateString()}
                  status={r.externalStatus}
                  href={`/instructor/classes/${r.offeringId}`}
                />
              )}
            />
          </S8Card>
        )}

        {d.followUps.length > 0 && (
          <S8Card title="My Follow-Ups">
            <S8List
              items={d.followUps.slice(0, 6)}
              empty=""
              render={(a: any) => (
                <div key={a.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{a.title}</p>
                      {a.description && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{a.description}</p>}
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{actionItemStatusLabel(a.status)}</span>
                  </div>
                  <form action={resolveInstructorFollowUp} className="mt-3">
                    <input type="hidden" name="actionItemId" value={a.id} />
                    <button className="min-h-11 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white">
                      Mark resolved
                    </button>
                  </form>
                </div>
              )}
            />
          </S8Card>
        )}

        <S8Card title="My Classes">
          <S8List
            items={d.classes.slice(0, 5)}
            empty="No assigned classes."
            render={(c: any) => (
              <S8Item key={c.id} title={c.title} meta={`${c.enrollments.length} students · ${c.sessions.length} sessions`} status={c.status} href={`/instructor/classes/${c.id}`} />
            )}
          />
        </S8Card>

        <S8Card title="Instructor Development" actionHref="/instructor/onboarding">
          <p className="text-sm text-slate-600">Onboarding, training, availability, performance evidence, feedback, and reviews are grouped in your development pages.</p>
        </S8Card>
      </S8Grid>
    </S8Page>
  );
}
