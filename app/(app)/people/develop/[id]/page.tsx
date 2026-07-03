import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Development records live inside the mentorship hub now. */
export default async function LegacyDevelopRecordRedirect(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  redirect(`/mentorship/people/${params.id}`);
}
