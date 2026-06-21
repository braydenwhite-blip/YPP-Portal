import { redirect } from "next/navigation";

// Canonical Impact Meetings hub is /impact-meetings. This alias keeps older
// People Strategy / Operations deep links from 404ing.
export default function OperationsImpactMeetingsRedirect() {
  redirect("/impact-meetings");
}
