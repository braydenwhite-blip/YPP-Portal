import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentDashboard } from "@/lib/session8/student-portal";
import { S8Page, S8Grid, S8Card, S8List, S8Item } from "@/components/session8/portal-ui";
import { dateTime, shortDate } from "@/lib/session8/format";

export default async function StudentHome() {
  const user = await requireStudentPortalUser();
  const data = await getStudentDashboard(user.id);
  const first = (data.user?.name ?? user.name ?? "there").split(" ")[0];

  return (
    <S8Page
      eyebrow="Student portal"
      title={`Hi ${first}. Here is what matters next.`}
      body="Your YPP home is organized by priority: what needs you, what's next, what you're doing, and what you've accomplished."
      primaryHref="/student/schedule"
      primaryLabel="Open schedule"
    >
      <S8Grid>
        {data.needsAttention.length ? (
          <S8Card title="Needs my attention">
            <S8List items={data.needsAttention} empty="" render={(i: any) => <S8Item key={i.kind + i.title} title={i.title} meta={shortDate(i.date)} status={i.status} href={i.href}>{i.kind}</S8Item>} />
          </S8Card>
        ) : null}

        {data.nextUp ? (
          <S8Card title="Next up" actionHref={data.nextUp.href ?? "/student/schedule"} actionLabel="Open">
            <S8Item title={data.nextUp.title} meta={dateTime(data.nextUp.date, data.nextUp.time)} status={data.nextUp.status} href={data.nextUp.href ?? undefined}>
              {data.nextUp.kind} · {data.nextUp.location ?? "Details available when authorized."}
            </S8Item>
          </S8Card>
        ) : null}

        {data.learning.active.length ? (
          <S8Card title="Continue learning" actionHref="/student/learning">
            <S8List items={data.learning.active.slice(0, 4)} empty="" render={(e: any) => <S8Item key={e.id} title={e.offering?.title ?? "YPP class"} meta={e.offering?.instructor?.name ?? "YPP instructor"} status={e.status} href={`/student/learning/classes/${e.offeringId}`}>{e.sessionsAttended} sessions attended</S8Item>} />
          </S8Card>
        ) : null}

        {data.recentProgress.length ? (
          <S8Card title="Recent progress" actionHref="/student/progress">
            <S8List items={data.recentProgress} empty="" render={(p: any) => <S8Item key={p.id} title={p.title ?? p.offering?.title ?? "Progress"} meta={shortDate(p.issuedAt ?? p.completedAt ?? p.releasedToFamilyAt)} status={p.status ?? p.template?.type} />} />
          </S8Card>
        ) : null}

        {data.recommendations.length ? (
          <S8Card title="Explore next" actionHref="/student/recommendations">
            <S8List items={data.recommendations} empty="" render={(r: any) => <S8Item key={r.id} title={r.title} meta={r.source} href={r.href}>{r.reason}</S8Item>} />
          </S8Card>
        ) : null}
      </S8Grid>

      {!data.needsAttention.length && !data.nextUp && !data.learning.active.length && !data.recentProgress.length && !data.recommendations.length ? (
        <S8Card title="Welcome to YPP">
          <p className="text-sm text-slate-600">Your account is set up but you&apos;re not enrolled in anything yet. Head to Explore to find your first opportunity.</p>
        </S8Card>
      ) : null}
    </S8Page>
  );
}
