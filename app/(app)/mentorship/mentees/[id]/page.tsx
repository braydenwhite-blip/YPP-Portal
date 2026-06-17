import { RelationshipWorkspace } from "@/components/mentorship/relationship-workspace/relationship-workspace";

export default async function MenteeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RelationshipWorkspace menteeId={id} />;
}
