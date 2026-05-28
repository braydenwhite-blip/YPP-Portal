import { permanentRedirect } from "next/navigation";

export const metadata = { title: "Schedule Meeting — YPP Mentorship" };

// Canonical mentee home is /my-mentor; scheduling now lives at /my-mentor/schedule.
export default function LegacyMyProgramSchedulePage() {
  permanentRedirect("/my-mentor/schedule");
}
