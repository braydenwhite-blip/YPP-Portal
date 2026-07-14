import { InstructorPreparationWorkspace } from "../../../../chapter/operations-workspace-ui";
export default async function Page({ params }: { params: Promise<{ classId: string }> }) { const { classId } = await params; return <InstructorPreparationWorkspace classId={classId} />; }
