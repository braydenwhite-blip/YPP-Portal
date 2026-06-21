import { redirect } from "next/navigation";

// The Impact Meetings / Impact Presentations workflow lives at the single
// canonical route /impact-meetings. Preserve older links by redirecting.
export default function ImpactPresentationsRedirect() {
  redirect("/impact-meetings");
}
