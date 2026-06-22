import { redirect } from "next/navigation";

// Impact Meetings / Impact Presentations now live inside the unified Meetings home.
export default function ImpactPresentationsRedirect() {
  redirect("/meetings");
}
