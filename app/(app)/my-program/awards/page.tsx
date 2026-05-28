import { permanentRedirect } from "next/navigation";

export const metadata = { title: "My Awards" };

// Canonical mentee home is /my-mentor; recognition & awards now live at
// /my-mentor/awards.
export default function LegacyMyProgramAwardsPage() {
  permanentRedirect("/my-mentor/awards");
}
