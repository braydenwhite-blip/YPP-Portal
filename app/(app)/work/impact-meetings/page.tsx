import { redirect } from "next/navigation";

// Canonical Impact Meetings hub is /impact-meetings. The Work Hub lives at
// /work, so /work/impact-meetings is a natural guess — alias it instead of 404.
export default function WorkImpactMeetingsRedirect() {
  redirect("/impact-meetings");
}
