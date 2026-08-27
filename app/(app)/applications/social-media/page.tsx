import { redirect } from "next/navigation";

/** Legacy route — Technology Manager replaced Social Media Manager. */
export default function LegacySocialMediaApplyRedirect() {
  redirect("/applications/technology-manager");
}
