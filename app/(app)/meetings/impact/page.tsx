import { redirect } from "next/navigation";

// Canonical Impact Meetings hub is /impact-meetings. This alias keeps older
// /meetings/impact deep links from 404ing.
export default function MeetingsImpactRedirect() {
  redirect("/impact-meetings");
}
