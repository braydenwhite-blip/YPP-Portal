import { requireStudentPortalUser } from "@/lib/family-access";
import { getFamilySupportRequests } from "@/lib/family-portal-data";
import { createStudentSupportRequest } from "@/lib/family-portal-actions";
import { familySupportStatusLabel } from "@/lib/session8/labels";

const cats = ["I cannot attend a session", "I have a schedule issue", "I cannot access the meeting", "I have a question about a class", "I want to change or leave a program", "I need help from an advisor", "I do not feel comfortable", "Something else"];

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string; offeringId?: string; sessionId?: string }> }) {
  const sp = await searchParams;
  const user = await requireStudentPortalUser();
  const reqs: any[] = await getFamilySupportRequests(user.id, "STUDENT");
  const prefillCategory = sp.category && cats.includes(sp.category) ? sp.category : undefined;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-violet-700">Support</p>
        <h1 className="text-3xl font-semibold">Ask YPP for help.</h1>
        <p className="text-slate-600">Choose a reason and YPP will route it safely.</p>
      </header>
      <form action={createStudentSupportRequest} className="rounded-3xl bg-white p-5 space-y-4">
        {sp.offeringId ? <input type="hidden" name="offeringId" value={sp.offeringId} /> : null}
        {sp.sessionId ? <input type="hidden" name="sessionId" value={sp.sessionId} /> : null}
        <label className="block">
          <span className="font-semibold">What do you need?</span>
          <select name="category" defaultValue={prefillCategory ?? cats[0]} className="mt-1 w-full rounded-xl border p-3">
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Tell us what happened</span>
          <textarea name="description" required className="mt-1 min-h-28 w-full rounded-xl border p-3" />
        </label>
        <button className="rounded-full bg-violet-700 px-4 py-2 font-semibold text-white">Send request</button>
      </form>
      <section className="rounded-3xl bg-white p-5">
        <h2 className="text-xl font-semibold">Your requests</h2>
        {reqs.length ? (
          <ul className="mt-3 space-y-3">
            {reqs.map((r) => (
              <li key={r.id} className="rounded-2xl border p-3">
                <b>{r.category}</b>
                <p className="text-sm text-slate-600">{familySupportStatusLabel(r.externalStatus)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-slate-600">No support requests yet.</p>
        )}
      </section>
    </div>
  );
}
