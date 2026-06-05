// Back-compat shim — the cron moved to /api/cron/action-leadership-escalation in
// the Phase 5 CPO→Leadership rename. Kept so a stale Vercel schedule hitting the
// old path during the deploy window still runs. Remove once vercel.json has
// rolled over (the only caller is the Vercel cron scheduler).
export { GET, runtime, dynamic, maxDuration } from "../action-leadership-escalation/route";
