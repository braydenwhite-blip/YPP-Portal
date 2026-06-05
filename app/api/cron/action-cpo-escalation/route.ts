// Back-compat shim — the cron moved to /api/cron/action-leadership-escalation in
// the Phase 5 CPO→Leadership rename. Kept so a stale Vercel schedule hitting the
// old path during the deploy window still runs. Remove once vercel.json has
// rolled over (the only caller is the Vercel cron scheduler).
// Route segment config must be declared inline — Turbopack requires these to be
// statically analyzable and rejects re-exporting them via `export ... from`.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export { GET } from "../action-leadership-escalation/route";
