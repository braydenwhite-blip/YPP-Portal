import { redirect } from "next/navigation";

export const metadata = { title: "Committee Prep Packet — YPP" };

export default async function LegacyPrepPacketPage({
  searchParams,
}: {
  searchParams: Promise<{ mentorshipId?: string }>;
}) {
  const params = await searchParams;
  const query = params.mentorshipId
    ? `?mentorshipId=${encodeURIComponent(params.mentorshipId)}`
    : "";
  redirect(`/mentorship/chair/prep-packet${query}`);
}
