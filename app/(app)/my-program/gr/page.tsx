import { permanentRedirect } from "next/navigation";

export const metadata = { title: "My Goals & Resources" };

// Canonical mentee home is /my-mentor; goals & resources now live at /my-mentor/goals.
export default function LegacyMyProgramGRPage() {
  permanentRedirect("/my-mentor/goals");
}
