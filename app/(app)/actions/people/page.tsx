import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy Action Tracker people dashboard → People hub directory. */
export default async function LegacyActionTrackerPeopleRedirect() {
  redirect("/people");
}
