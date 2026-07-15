import { requireStudentPortalUser } from "@/lib/family-access";
import { getStudentRecommendations } from "@/lib/session8/student-portal";
import { expressRecommendationInterest } from "@/lib/session8/actions";
import { S8Page, S8Grid, S8Card } from "@/components/session8/portal-ui";

export default async function Page() {
  const u = await requireStudentPortalUser();
  const recs = await getStudentRecommendations(u.id);
  return (
    <S8Page
      eyebrow="Recommendations"
      title="Recommended next opportunities"
      body="Recommendations come from your interests, completed participation, advisor or instructor sources, and available YPP programs — not fabricated AI reasoning."
    >
      <S8Grid>
        {recs.map((r: any) => (
          <S8Card key={r.id} title={r.title} subtitle={r.source} actionHref={r.opportunityHref ?? r.href} actionLabel="View opportunity">
            <p className="text-sm text-slate-600">{r.reason}</p>
            <p className="text-sm text-slate-500">Eligibility: {r.eligibility}</p>
            {r.passionId ? (
              <form action={expressRecommendationInterest}>
                <input type="hidden" name="passionId" value={r.passionId} />
                <button className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white">I&apos;m interested</button>
              </form>
            ) : null}
          </S8Card>
        ))}
      </S8Grid>
    </S8Page>
  );
}
