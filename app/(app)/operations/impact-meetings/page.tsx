import { redirect } from "next/navigation";

// Impact Meetings now live inside the unified Meetings home.
export default function OperationsImpactMeetingsRedirect() {
  redirect("/meetings");
}
