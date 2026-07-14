import { InstructorPreparationWorkspace } from "../../../../chapter/operations-workspace-ui";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <InstructorPreparationWorkspace classId={id} />; }
